package netsec.ethz.ch.verifier.LogVerification;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.view.View;
import android.widget.ImageView;

import netsec.ethz.ch.verifier.MainActivity;
import netsec.ethz.ch.verifier.R;

public class LogResultActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_log_result);

        setTitle("Verification Result");

        Intent intent = getIntent();

        ImageView img = findViewById(R.id.logResultView);

        if ((boolean) intent.getExtras().get("result")) {
            img.setBackgroundColor(Color.GREEN);
        } else {
            img.setBackgroundColor(Color.RED);
        }
    }

    public void onClickMenu(View view) {
        Intent next = new Intent(this, MainActivity.class);
        next.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(next);
    }
}
