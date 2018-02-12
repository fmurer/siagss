package netsec.ethz.ch.verifier.Initialisation;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.view.View;
import android.widget.EditText;

import netsec.ethz.ch.verifier.Constants;
import netsec.ethz.ch.verifier.R;

public class InitMainActivity extends AppCompatActivity {

    EditText numAdmin, threshold;
    public static String settings;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_init_main);

        setTitle("Config Setup");

        Intent intent = getIntent();
        if (intent.getBooleanExtra("simple", true)) {
            settings = Constants.CONFIG_SETTINGS;
        } else {
            settings = Constants.REPLICATION_SETTINGS;
        }

        numAdmin = (EditText) findViewById(R.id.numAdmin);
        threshold = (EditText) findViewById(R.id.threshold);

        SharedPreferences preferences = getSharedPreferences(InitMainActivity.settings, MODE_PRIVATE);

        numAdmin.setText(String.valueOf(preferences.getInt(Constants.NUM_ADMINS, 0)));
        threshold.setText(String.valueOf(preferences.getInt(Constants.THRESHOLD, 0)));

        SharedPreferences.Editor editor = preferences.edit();

        editor.remove(Constants.EPOCH);
        editor.remove(Constants.SIGNER_KEY);
        editor.remove(Constants.TPM_PUB_KEY);
        editor.remove(Constants.ID);

        editor.apply();
    }

    public void onClickSetConfig(View view) {

        SharedPreferences preferences = getSharedPreferences(InitMainActivity.settings, MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();

        int N = Integer.valueOf(numAdmin.getText().toString());
        int t = Integer.valueOf(threshold.getText().toString());

        editor.putInt(Constants.NUM_ADMINS, N);
        editor.putInt(Constants.THRESHOLD, t);

        editor.apply();

        if (N > 0 && t > 0) {
            Intent intent = new Intent(this, ScanTPMActivity.class);
            startActivity(intent);
        }
    }
}
