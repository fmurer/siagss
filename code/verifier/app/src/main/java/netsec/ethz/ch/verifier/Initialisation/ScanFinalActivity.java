package netsec.ethz.ch.verifier.Initialisation;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.util.Base64;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.iwebpp.crypto.TweetNaclFast;

import org.json.JSONException;
import org.json.JSONObject;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import netsec.ethz.ch.verifier.Constants;
import netsec.ethz.ch.verifier.MainActivity;
import netsec.ethz.ch.verifier.R;

public class ScanFinalActivity extends AppCompatActivity {

    Button button;
    TextView resultView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_scan_final);

        setTitle("Scan the Response");

        button = findViewById(R.id.scanfinal);
        resultView = findViewById(R.id.resultview);
    }

    public void onActivityResult(int requestCode, int resultCode, Intent intent) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, intent);

        if (result != null) {
            if (result.getContents() != null) {
                SharedPreferences preferences = getSharedPreferences(InitMainActivity.settings, MODE_PRIVATE);
                SharedPreferences.Editor editor = preferences.edit();

                if (verify(result)) {
                    try {
                        JSONObject response = new JSONObject(result.getContents());

                        int id = response.getInt("id");
                        String list_of_keys = response.getJSONObject("admin_keys").toString();
                        String signer_pub = response.getString("pub_key");
                        String enc_key = response.getString("enc_key");

                        editor.putInt(Constants.ID, id);
                        editor.putString(Constants.ALL_KEYS, list_of_keys);
                        editor.putString(Constants.SIGNER_KEY, signer_pub);
                        editor.putString(Constants.ENC_PUBLIC_KEY, enc_key);

                        resultView.setBackgroundColor(Color.GREEN);

                        TweetNaclFast.Signature new_sig = new TweetNaclFast.Signature(Base64.decode(signer_pub, Base64.NO_WRAP),
                                                                            Base64.decode(preferences.getString(Constants.PRIVATE_KEY, ""), Base64.NO_WRAP));

                        MainActivity.sign_signer.put(InitMainActivity.settings, new_sig);

                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
                } else {
                    resultView.setBackgroundColor(Color.RED);
                }

                editor.apply();
            }
        }

        button.setText("Main Menu");

        final Intent next = new Intent(this, MainActivity.class);
        next.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                startActivity(next);
            }
        });
    }

    public void onClickScan(View view) {
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.initiateScan();
    }

    public boolean verify(IntentResult result) {

        SharedPreferences preferences = getSharedPreferences(InitMainActivity.settings, MODE_PRIVATE);

        try {
            JSONObject response = new JSONObject(result.getContents());

            int id = response.getInt("id");
            JSONObject list_of_keys = response.getJSONObject("admin_keys");
            String signer_pub = response.getString("pub_key");
            String nonce = response.getString("nonce");
            String hash = response.getString("hash");
            String signature = response.getString("signature");
            signature = signature.replace("\\", "");

            if (!nonce.equals(preferences.getString(Constants.NONCE, ""))) {
                return false;
            }

            if (!list_of_keys.has(preferences.getString(Constants.PUBLIC_KEY, ""))) {
                return false;
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            JSONObject toHash = new JSONObject();
            toHash.put("pub_key", signer_pub);
            toHash.put("N", preferences.getInt(Constants.NUM_ADMINS, 0));
            toHash.put("t", preferences.getInt(Constants.THRESHOLD, 0));
            toHash.put("admin_keys", list_of_keys);

            digest.update(toHash.toString().replace("\\", "").getBytes());
            byte[] calcHash = digest.digest();

            String calcHashenc = new String(Base64.encode(calcHash, Base64.NO_WRAP));

            if (!hash.equals(calcHashenc)) {
                System.out.println("HASH COMPARISON FAILED");
                return false;
            }

            JSONObject signedStuff = new JSONObject();
            signedStuff.put("nonce", nonce);
            signedStuff.put("hash", hash);

            byte sig[] = Base64.decode(signature, Base64.NO_WRAP);

            String signedStufftoString = signedStuff.toString().replace("\\", "");

            boolean verified = MainActivity.sign_tpm.get(InitMainActivity.settings).detached_verify(signedStufftoString.getBytes(), sig);

            if (!verified) {
                return false;
            }

        } catch (JSONException e) {
            e.printStackTrace();
        } catch (NoSuchAlgorithmException e) {
            e.printStackTrace();
        }
        return true;
    }
}
