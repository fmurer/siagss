package netsec.ethz.ch.verifier.Initialisation;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.View;
import android.widget.ImageView;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.iwebpp.crypto.TweetNaclFast;

import org.json.JSONException;
import org.json.JSONObject;

import netsec.ethz.ch.verifier.Constants;
import netsec.ethz.ch.verifier.MainActivity;
import netsec.ethz.ch.verifier.R;

public class SendConfigActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_send_config);

        setTitle("Send the Config");

        initKeys();

        SharedPreferences preferences = getSharedPreferences(Constants.CONFIG_SETTINGS,  MODE_PRIVATE);

        int N = preferences.getInt(Constants.NUM_ADMINS, 1);
        int t = preferences.getInt(Constants.THRESHOLD, 1);
        String pub_key = preferences.getString(Constants.PUBLIC_KEY, null);

        JSONObject msg = new JSONObject();
        JSONObject config = new JSONObject();

        try {
            config.put("N", N);
            config.put("t", t);

            msg.put("config", config);
            msg.put("pub_key", pub_key);
        } catch (JSONException e) {
            e.printStackTrace();
        }

        showConfig(msg.toString());

    }

    void initKeys() {
        SharedPreferences preferences = getSharedPreferences(Constants.CONFIG_SETTINGS,  MODE_PRIVATE);
        SharedPreferences replication = getSharedPreferences(Constants.REPLICATION_SETTINGS, MODE_PRIVATE);

        String publicKey = preferences.getString(Constants.PUBLIC_KEY, null);

        if (publicKey == null) {
            TweetNaclFast.Signature.KeyPair keyPair = TweetNaclFast.Signature.keyPair();
            try {
                publicKey = Base64.encodeToString(keyPair.getPublicKey(), Base64.NO_WRAP);
                String privateKey = Base64.encodeToString(keyPair.getSecretKey(), Base64.NO_WRAP);

                SharedPreferences.Editor editor = preferences.edit();
                editor.putString(Constants.PUBLIC_KEY, publicKey);
                editor.putString(Constants.PRIVATE_KEY, privateKey);
                editor.apply();

                SharedPreferences.Editor rep_edit = replication.edit();
                rep_edit.putString(Constants.PUBLIC_KEY, publicKey);
                rep_edit.putString(Constants.PRIVATE_KEY, privateKey);
                rep_edit.apply();

            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        SharedPreferences current = getSharedPreferences(InitMainActivity.settings, MODE_PRIVATE);

        TweetNaclFast.Signature new_sig = new TweetNaclFast.Signature(Base64.decode(current.getString(Constants.TPM_PUB_KEY, ""), Base64.NO_WRAP),
                                                                    Base64.decode(current.getString(Constants.PRIVATE_KEY, ""), Base64.NO_WRAP));

        MainActivity.sign_tpm.put(InitMainActivity.settings, new_sig);
    }

    void showConfig(String data) {
        ImageView qrcode = findViewById(R.id.qrcode_config);
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

    public void onClickNext(View view) {
        Intent intent = new Intent(this, SendNonceActivity.class);
        startActivity(intent);
    }
}
