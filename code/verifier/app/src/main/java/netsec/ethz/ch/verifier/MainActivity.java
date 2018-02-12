 package netsec.ethz.ch.verifier;

 import android.content.Intent;
 import android.content.SharedPreferences;
 import android.os.Bundle;
 import android.support.v7.app.AppCompatActivity;
 import android.util.ArrayMap;
 import android.view.View;
 import android.widget.Toast;

 import com.iwebpp.crypto.TweetNaclFast;

 import java.util.Map;

 import netsec.ethz.ch.verifier.Initialisation.InitChoiceActivity;
 import netsec.ethz.ch.verifier.KeyReplication.KeyRepMainActivity;
 import netsec.ethz.ch.verifier.LogVerification.LogChoiceActivity;


 public class MainActivity extends AppCompatActivity {

    public static Map<String, TweetNaclFast.Signature> sign_tpm = new ArrayMap<String, TweetNaclFast.Signature>(2);
    public static Map<String, TweetNaclFast.Signature> sign_signer = new ArrayMap<String, TweetNaclFast.Signature>(2);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
    }

    public void onClickInit(View view) {
        Intent intent = new Intent(this, InitChoiceActivity.class);
        startActivity(intent);
    }

     public void onClickLogVerify(View view) {
         Intent intent = new Intent(this, LogChoiceActivity.class);
         startActivity(intent);
     }

     public void onClickKeyRep(View view) {
         Intent intent = new Intent(this, KeyRepMainActivity.class);

         SharedPreferences prefs = getSharedPreferences(Constants.REPLICATION_SETTINGS, MODE_PRIVATE);

         if (prefs.getString(Constants.SIGNER_KEY, "-1").equals("-1")) {
             Toast toast = Toast.makeText(this,"Initiate a Replication first", Toast.LENGTH_SHORT);
             toast.show();
         } else {
             startActivity(intent);
         }
     }
}
