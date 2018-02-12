package netsec.ethz.ch.verifier.LogVerification;

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

import java.security.SecureRandom;

import netsec.ethz.ch.verifier.Constants;
import netsec.ethz.ch.verifier.MainActivity;
import netsec.ethz.ch.verifier.R;


public class LogVerifMainActivity extends AppCompatActivity {

    public static String settings;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_log_verif_main);

        setTitle("Scan Known Epoch");

        Intent intent = getIntent();

        if (intent.getBooleanExtra("simple", true)) {
            settings = Constants.CONFIG_SETTINGS;
        } else {
            settings = Constants.REPLICATION_SETTINGS;
        }

        SharedPreferences preferences = getSharedPreferences(LogVerifMainActivity.settings, MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();

        TweetNaclFast.Signature new_sig = new TweetNaclFast.Signature(Base64.decode(preferences.getString(Constants.SIGNER_KEY, ""), Base64.NO_WRAP),
                Base64.decode(preferences.getString(Constants.PRIVATE_KEY, ""), Base64.NO_WRAP));

        MainActivity.sign_signer.put(settings, new_sig);

        String epoch = preferences.getString(Constants.EPOCH, "-1");

        SecureRandom random = new SecureRandom();
        byte bytes[] = new byte[16];
        random.nextBytes(bytes);

        String nonce = new String(Base64.encode(bytes, Base64.NO_WRAP));
        editor.putString(Constants.NONCE, nonce);
        editor.apply();

        System.out.println("IM HERE");

        JSONObject to_verify = new JSONObject();

        String signature = "";

        try {
            to_verify.put("epoch", epoch);
            to_verify.put("nonce", nonce);

            byte sig[] = MainActivity.sign_signer.get(settings).detached(to_verify.toString().replace("\\", "").getBytes());
            signature = Base64.encodeToString(sig, Base64.NO_WRAP);

            to_verify.put("signature", signature);
        } catch (JSONException e) {
            e.printStackTrace();
        }

        showConfig(to_verify.toString());

    }

    void showConfig(String data) {
        ImageView qrcode = findViewById(R.id.qrcode_log);
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
        Intent intent = new Intent(this, ScanLogsActivity.class);
        startActivity(intent);
    }
}
