package app.rivers;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

public class RiversTileService extends TileService {
    @Override
    public void onStartListening() {
        paint();
    }

    @Override
    public void onClick() {
        unlockAndRun(this::toggle);
    }

    private void toggle() {
        if (RiversVpnService.running || RiversVpnService.starting) {
            startService(new Intent(this, RiversVpnService.class).setAction(RiversVpnService.ACTION_STOP));
            return;
        }
        Intent consent = VpnService.prepare(this);
        if (consent != null) {
            Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (Build.VERSION.SDK_INT >= 34) {
                startActivityAndCollapse(PendingIntent.getActivity(this, 7, open, PendingIntent.FLAG_IMMUTABLE));
            } else {
                startActivityAndCollapse(open);
            }
            return;
        }
        Intent start = new Intent(this, RiversVpnService.class).setAction(RiversVpnService.ACTION_START);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(start);
        else startService(start);
    }

    private void paint() {
        Tile tile = getQsTile();
        if (tile == null) return;
        boolean on = RiversVpnService.running;
        tile.setState(on ? Tile.STATE_ACTIVE : Tile.STATE_INACTIVE);
        tile.setLabel("Rivers");
        tile.setContentDescription(on ? "Rivers включён" : "Rivers выключен");
        tile.updateTile();
    }
}
