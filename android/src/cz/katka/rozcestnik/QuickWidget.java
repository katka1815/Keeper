package cz.katka.rozcestnik;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Widget na plochu: pole otevře okýnko rychlé poznámky, šipka otevře celý Rozcestník. */
public class QuickWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent note = new Intent(c, CaptureActivity.class).setAction("cz.katka.rozcestnik.NOTE")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
            v.setOnClickPendingIntent(R.id.w_add, PendingIntent.getActivity(c, 1, note, flags));
            v.setOnClickPendingIntent(R.id.w_open, PendingIntent.getActivity(c, 2, open, flags));
            m.updateAppWidget(id, v);
        }
    }
}
