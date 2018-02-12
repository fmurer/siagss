package netsec.ethz.ch.verifier.KeyReplication;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.Toast;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.iwebpp.crypto.TweetNaclFast;

import org.json.JSONException;
import org.json.JSONObject;

import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import netsec.ethz.ch.verifier.Constants;
import netsec.ethz.ch.verifier.LogVerification.LogResultActivity;
import netsec.ethz.ch.verifier.LogVerification.LogVerifMainActivity;
import netsec.ethz.ch.verifier.MainActivity;
import netsec.ethz.ch.verifier.R;

public class ScanEncKeyActivity extends AppCompatActivity {

    Button scan;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_scan_enc_key);

        scan = findViewById(R.id.scanKey);
    }

    public void onClickScan(View view) {
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.initiateScan();
    }

    public void onActivityResult(int requestCode, int resultCode, Intent intent) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, intent);

        SharedPreferences signerPref = getSharedPreferences(Constants.CONFIG_SETTINGS, MODE_PRIVATE);
        SharedPreferences repPref = getSharedPreferences(Constants.REPLICATION_SETTINGS, MODE_PRIVATE);

        if (result != null) {
            if (result.getContents() != null) {
                try {
                    JSONObject response = new JSONObject(result.getContents());

                    String nonce = response.getString("nonce");
                    nonce = nonce.replace("\\","");

                    String enc_key = response.getString("encrypted_key");
                    enc_key = enc_key.replace("\\", "");

                    String signature = response.getString("signature");
                    signature = signature.replace("\\", "");

                    byte sig[] = Base64.decode(signature, Base64.NO_WRAP);

                    // verify signature
                    JSONObject to_verify = new JSONObject();
                    to_verify.put("nonce", nonce);
                    to_verify.put("encrypted_key", enc_key);
                    String to_verify_string = to_verify.toString().replace("\\", "");

                    boolean verified = MainActivity.sign_signer.get(Constants.CONFIG_SETTINGS).detached_verify(to_verify_string.getBytes(), sig);

                    if (!verified) {
                        Toast toast = Toast.makeText(this, "Message could not be verified! Abort!", Toast.LENGTH_SHORT);
                        toast.show();
                        return;
                    }

                    JSONObject to_send = new JSONObject();
                    to_send.put("pub_key", signerPref.getString(Constants.ENC_PUBLIC_KEY, ""));
                    to_send.put("nonce", nonce);
                    to_send.put("encrypted_key", enc_key);
                    String to_send_string = to_send.toString().replace("\\", "");

                    byte new_sig[] = MainActivity.sign_signer.get(Constants.REPLICATION_SETTINGS).detached(to_send_string.getBytes());
                    String new_sig_b64 = Base64.encodeToString(new_sig, Base64.NO_WRAP);

                    to_send.put("signature", new_sig_b64);

                    showConfig(to_send.toString().replace("\\", ""));

                } catch (JSONException e) {
                    e.printStackTrace();
                }
            }
        }
    }

    void showConfig(String data) {
        ImageView qrcode = findViewById(R.id.enc_key_view);
        qrcode.setDrawingCacheEnabled(true);
        Bitmap mBitmap = qrcode.getDrawingCache();

        DisplayMetrics displayMetrics = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(displayMetrics);
        int width = displayMetrics.widthPixels;

        try {
            BitMatrix matrix = new MultiFormatWriter().encode(data, BarcodeFormat.QR_CODE, width, width);
            mBitmap = Bitmap.createBitmap(width, width, Bitmap.Config.ARGB_8888);

            for (int i = 0; i < width; i++) {
                for (int j = 0; j < width; j++) {
                    mBitmap.setPixel(i, j, matrix.get(i,j) ? Color.BLACK : Color.WHITE);
                }
            }
        } catch (WriterException e) {
            e.printStackTrace();
        }
        if (mBitmap != null) {
            qrcode.setImageBitmap(mBitmap);
        }
    }

    public long bytesToLong(byte[] bytes) {
        ByteBuffer buffer = ByteBuffer.allocate(Long.BYTES);
        buffer.put(bytes, 0, bytes.length);
        buffer.flip();
        return buffer.getLong();
    }
}
