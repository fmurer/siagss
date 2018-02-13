package netsec.ethz.ch.verifier.Initialisation;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import netsec.ethz.ch.verifier.Constants;
import netsec.ethz.ch.verifier.R;

public class ScanTPMActivity extends AppCompatActivity {

    Button button;
    TextView resultView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_scan_tpm);

        setTitle("Scan the TPM");

        button = findViewById(R.id.scanTPM);
        resultView = findViewById(R.id.scanresult);
    }

    public void onActivityResult(int requestCode, int resultCode, Intent intent) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, intent);

        if (result != null) {
            if (result.getContents() != null) {
                SharedPreferences preferences = getSharedPreferences(InitMainActivity.settings, MODE_PRIVATE);
                SharedPreferences.Editor editor = preferences.edit();

                String tpm_key = result.getContents();
                tpm_key = tpm_key.substring(1, tpm_key.length()-1);

                editor.putString(Constants.TPM_PUB_KEY, tpm_key);
                editor.apply();

                resultView.setText(tpm_key);
                button.setText("Next");

                final Intent next = new Intent(this, SendConfigActivity.class);

                button.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        startActivity(next);
                    }
                });
            }
        }
    }

    public void onClickScan(View view) {
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.initiateScan();
    }
}
