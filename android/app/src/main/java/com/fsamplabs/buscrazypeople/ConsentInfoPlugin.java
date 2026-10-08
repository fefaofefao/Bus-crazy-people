package com.fsamplabs.buscrazypeople;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lê a decisão de consentimento que o UMP (Google User Messaging Platform) grava
 * no aparelho no padrão IAB TCF v2 (SharedPreferences padrão do app):
 *   IABTCF_gdprApplies       1 = GDPR se aplica a este usuário, 0 = não
 *   IABTCF_PurposeConsents   "1011..." – posição N = finalidade N consentida
 * Usado por src/analytics.ts para ligar/desligar o Firebase Analytics.
 */
@CapacitorPlugin(name = "ConsentInfo")
public class ConsentInfoPlugin extends Plugin {

    @PluginMethod
    public void getTcf(PluginCall call) {
        try {
            // mesmas SharedPreferences "padrão" do app (nome <pacote>_preferences), onde o UMP grava o TCF
            Context ctx = getContext();
            SharedPreferences prefs = ctx.getSharedPreferences(ctx.getPackageName() + "_preferences", Context.MODE_PRIVATE);
            JSObject ret = new JSObject();
            int applies = -1;
            try {
                applies = prefs.getInt("IABTCF_gdprApplies", -1);
            } catch (ClassCastException e) {
                // alguns CMPs gravam como texto
                String s = prefs.getString("IABTCF_gdprApplies", "-1");
                try {
                    applies = Integer.parseInt(s);
                } catch (NumberFormatException ignored) {}
            }
            ret.put("gdprApplies", applies);
            ret.put("purposeConsents", prefs.getString("IABTCF_PurposeConsents", ""));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("ConsentInfo indisponível", e);
        }
    }
}
