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

import org.json.JSONException;
import org.json.JSONObject;

import java.security.SecureRandom;

import netsec.ethz.ch.verifier.Constants;
import netsec.ethz.ch.verifier.MainActivity;
import netsec.ethz.ch.verifier.R;

public class SendNonceActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_send_nonce);

        setTitle("Send the Nonce");

        SecureRandom random = new SecureRandom();
        byte bytes[] = new byte[16];
        random.nextBytes(bytes);

        String nonce = Base64.encodeToString(bytes, Base64.NO_WRAP);

        SharedPreferences preferences = getSharedPreferences(InitMainActivity.settings, MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putString(Constants.NONCE, nonce);
        editor.apply();

        String signature = "";

        byte sig[] = MainActivity.sign_tpm.get(InitMainActivity.settings).detached(bytes);
        signature = Base64.encodeToString(sig, Base64.NO_WRAP);

        JSONObject msg = new JSONObject();
        try {
            msg.put("nonce", nonce);
            msg.put("signature", signature);
        } catch (JSONException e) {
            e.printStackTrace();
        }

        showNonce(msg.toString());
    }

    void showNonce(String data) {
        ImageView qrcode = findViewById(R.id.qrcode_nonce);
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
        Intent intent = new Intent(this, ScanFinalActivity.class);
        startActivity(intent);
    }
}
