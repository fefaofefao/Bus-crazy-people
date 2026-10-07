package com.fsamplabs.buscrazypeople;

import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Ponta a ponta em todas as versões do Android (no 15+ já é o padrão).
        // As áreas seguras chegam ao jogo pelo plugin SystemBars (capacitor.config.json).
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
        // Retrato só em celulares; tablets e telas grandes podem girar e redimensionar
        // (o layout do jogo se adapta a qualquer proporção).
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
        super.onCreate(savedInstanceState);
    }
}
