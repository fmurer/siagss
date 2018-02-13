package netsec.ethz.ch.verifier.KeyReplication;

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

import netsec.ethz.ch.verifier.Constants;
import netsec.ethz.ch.verifier.LogVerification.ScanLogsActivity;
import netsec.ethz.ch.verifier.MainActivity;
import netsec.ethz.ch.verifier.R;

public class KeyRepMainActivity extends AppCompatActivity {


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_key_rep_main);

        JSONObject to_send = new JSONObject();
        SharedPreferences pref_orig = getSharedPreferences(Constants.CONFIG_SETTINGS, MODE_PRIVATE);
        SharedPreferences pref_rep = getSharedPreferences(Constants.REPLICATION_SETTINGS, MODE_PRIVATE);

        try {
            to_send.put("replication_key", pref_rep.getString(Constants.ENC_PUBLIC_KEY, ""));
            to_send.put("id", pref_orig.getInt(Constants.ID, 0));

            String to_send_string = to_send.toString().replace("\\", "");
            byte sig[] = MainActivity.sign_signer.get(Constants.CONFIG_SETTINGS).detached(to_send_string.getBytes());
            String signature = Base64.encodeToString(sig, Base64.NO_WRAP);

            to_send.put("signature", signature);
        } catch (JSONException e) {
            e.printStackTrace();
        }

        showConfig(to_send.toString().replace("\\", ""));
    }

    void showConfig(String data) {
        ImageView qrcode = findViewById(R.id.repl_init);
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
        Intent intent = new Intent(this, ScanEncKeyActivity.class);
        startActivity(intent);
    }

}
