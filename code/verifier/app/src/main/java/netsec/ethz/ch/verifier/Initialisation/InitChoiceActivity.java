package netsec.ethz.ch.verifier.Initialisation;

import android.content.Intent;
import android.content.SharedPreferences;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import netsec.ethz.ch.verifier.Constants;
import netsec.ethz.ch.verifier.R;

public class InitChoiceActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_init_choice);

        setTitle("Choose the Initialisation");
    }

    public void onclickSimple(View view) {
        Intent intent = new Intent(this, InitMainActivity.class);
        intent.putExtra("simple", true);
        startActivity(intent);
    }

    public void onclickRepl(View view) {
        Intent intent = new Intent(this, InitMainActivity.class);
        intent.putExtra("simple", false);

        SharedPreferences pref = getSharedPreferences(Constants.CONFIG_SETTINGS, MODE_PRIVATE);

        if (pref.getString(Constants.SIGNER_KEY, "-1").equals("-1")) {
            Toast toast = Toast.makeText(this, "Need a Signer before Replication", Toast.LENGTH_SHORT);
            toast.show();
        } else {
            startActivity(intent);
        }
    }
}
