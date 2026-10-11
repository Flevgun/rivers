package app.rivers;

import android.content.Context;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;

public final class Palette {
    public final String id;
    public final String name;
    public final int bg;
    public final int surface;
    public final int raised;
    public final int fg;
    public final int muted;
    public final int accent;
    public final int ink;
    public final int danger;
    public final int line;

    private Palette(String id, String name, int bg, int surface, int raised, int fg, int muted, int accent, int ink, int danger, int line) {
        this.id = id;
        this.name = name;
        this.bg = bg;
        this.surface = surface;
        this.raised = raised;
        this.fg = fg;
        this.muted = muted;
        this.accent = accent;
        this.ink = ink;
        this.danger = danger;
        this.line = line;
    }

    public static Palette current(Context context) {
        return byId(Store.theme(context));
    }

    public static Palette byId(String id) {
        for (Palette palette : all()) if (palette.id.equals(id)) return palette;
        return all()[0];
    }

    public static Palette[] all() {
        return new Palette[]{
                new Palette("mint", "Мята", 0xFF07080A, 0xFF121418, 0xFF1C1F26, 0xFFF2F4F7, 0xFF8B939E, 0xFF3DFFB0, 0xFF06281A, 0xFFFF5D6C, 0xFF2A2E36),
                new Palette("night", "Ночь", 0xFF07080F, 0xFF12141C, 0xFF1C2030, 0xFFF2F4F7, 0xFF8B93A8, 0xFF8EA2FF, 0xFF0C1230, 0xFFFF5D6C, 0xFF2A2E42),
                new Palette("paper", "Бумага", 0xFFF3F5F7, 0xFFFFFFFF, 0xFFE7EBF0, 0xFF121418, 0xFF5C6570, 0xFF0C8F62, 0xFFF4FFF9, 0xFFD21B3A, 0xFFD5DBE3),
                new Palette("amber", "Янтарь", 0xFF100E0B, 0xFF1A1612, 0xFF262018, 0xFFF6F1E8, 0xFFA39888, 0xFFFFB020, 0xFF2A1C00, 0xFFFF5D6C, 0xFF3A3228),
        };
    }

    public static GradientDrawable round(Context context, int fill, int stroke, float radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(context, radiusDp));
        if (stroke != 0) drawable.setStroke(Math.max(1, (int) dp(context, 1)), stroke);
        return drawable;
    }

    public static GradientDrawable circle(int fill, int stroke, int strokePx) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setColor(fill);
        if (strokePx > 0) drawable.setStroke(strokePx, stroke);
        return drawable;
    }

    public static float dp(Context context, float value) {
        return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, context.getResources().getDisplayMetrics());
    }
}
