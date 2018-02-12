package netsec.ethz.ch.verifier.LogVerification;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.util.Base64;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import org.json.JSONException;
import org.json.JSONObject;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import netsec.ethz.ch.verifier.Constants;
import netsec.ethz.ch.verifier.MainActivity;
import netsec.ethz.ch.verifier.R;

public class ScanLogsActivity extends AppCompatActivity {

    Button scanResponse;
    TextView logs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_scan_logs);

        setTitle("Logs");

        scanResponse = findViewById(R.id.scanLogs);
        logs = findViewById(R.id.logs);

        /*
        SharedPreferences preferences = getSharedPreferences(Constants.CONFIG_SETTINGS, MODE_PRIVATE);
        MainActivity.signer_sig = new TweetNaclFast.Signature(Base64.decode(preferences.getString(Constants.SIGNER_KEY, ""), Base64.NO_WRAP),
                Base64.decode(preferences.getString(Constants.PRIVATE_KEY, ""), Base64.NO_WRAP));
        */
    }

    public void onClickScan(View view) {
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.initiateScan();
    }

    public void onActivityResult(int requestCode, int resultCode, Intent intent) {
        final IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, intent);

        if (result != null) {
            if (result.getContents() != null) {
                SharedPreferences preferences = getSharedPreferences(Constants.CONFIG_SETTINGS, MODE_PRIVATE);
                SharedPreferences.Editor editor = preferences.edit();

                try {
                    JSONObject response = new JSONObject(result.getContents());

                    String log = response.getString("logs");
                    log = log.replace("\\", "");
                    log = new String(Base64.decode(log, Base64.NO_WRAP));

                    logs.setText(log);

                } catch (JSONException e) {
                    e.printStackTrace();
                }

                editor.apply();
            }
        }

        scanResponse.setText("Verify Log");

        scanResponse.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                try {
                    JSONObject response = new JSONObject(result.getContents());

                    Intent newIntent = new Intent(getApplicationContext(), LogResultActivity.class);

                    if (verify(response)) {
                        SharedPreferences preferences = getSharedPreferences(Constants.CONFIG_SETTINGS, MODE_PRIVATE);
                        SharedPreferences.Editor editor = preferences.edit();
                        editor.putString(Constants.EPOCH, response.getString("latest_epoch"));
                        editor.apply();

                        newIntent.putExtra("result", true);
                    } else {
                        newIntent.putExtra("result", false);
                    }

                    startActivity(newIntent);

                } catch (JSONException | NoSuchAlgorithmException e) {
                    e.printStackTrace();
                }
            }

            boolean verify(JSONObject response) throws JSONException, NoSuchAlgorithmException {
                SharedPreferences preferences = getSharedPreferences(Constants.CONFIG_SETTINGS, MODE_PRIVATE);

                String latest_epoch = response.getString("latest_epoch");
                String nonce = response.getString("nonce");

                String log = response.getString("logs");
                log = log.replace("\\", "");

                String signature = response.getString("signature");
                signature = signature.replace("\\", "");

                byte sig[] = Base64.decode(signature, Base64.NO_WRAP);

                JSONObject to_verify = new JSONObject();
                to_verify.put("latest_epoch", latest_epoch);
                to_verify.put("nonce", nonce);
                to_verify.put("logs", log);

                String to_verify_String = to_verify.toString().replace("\\", "");

                boolean verified = MainActivity.sign_signer.get(LogVerifMainActivity.settings).detached_verify(to_verify_String.getBytes(), sig);

                if (!verified) {
                    return false;
                }

                if (!nonce.equals(preferences.getString(Constants.NONCE, ""))) {
                    return false;
                }

                log = new String(Base64.decode(log, Base64.NO_WRAP));
                String splittedLogs[] = log.split("\n");
                String old_hash = preferences.getString(Constants.EPOCH, "");
                old_hash = (old_hash.equals("-1") ? "" : old_hash);
                String new_hash = "";

                for (String line : splittedLogs) {
                    if (!line.equals("")) {
                        String concat = old_hash + line;
                        MessageDigest md = MessageDigest.getInstance("SHA-256");
                        md.update(concat.getBytes());
                        //new_hash = String.format("%040x", new BigInteger(1, md.digest()));
                        new_hash = bytesToHex(md.digest());
                        old_hash = new_hash;
                    }
                }

                if (!new_hash.equals(latest_epoch) && !old_hash.equals(latest_epoch)) {
                    return false;
                }

                return true;
            }
        });
    }

    private final static char[] hexArray = "0123456789abcdef".toCharArray();
    public static String bytesToHex(byte[] bytes) {
        char[] hexChars = new char[bytes.length * 2];
        for ( int j = 0; j < bytes.length; j++ ) {
            int v = bytes[j] & 0xff;
            hexChars[j * 2] = hexArray[v >>> 4];
            hexChars[j * 2 + 1] = hexArray[v & 0x0f];
        }
        return new String(hexChars);
    }
}
