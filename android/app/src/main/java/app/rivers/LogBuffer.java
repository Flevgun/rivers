package app.rivers;

import java.util.ArrayDeque;

public final class LogBuffer {
    private static final int LIMIT = 200;
    private static final ArrayDeque<String> LINES = new ArrayDeque<>();

    private LogBuffer() {}

    public static synchronized void add(String line) {
        if (line == null) return;
        String trimmed = line.replaceAll("\u001B\\[[0-9;]*m", "").trim();
        if (trimmed.isEmpty()) return;
        LINES.addLast(trimmed);
        while (LINES.size() > LIMIT) LINES.removeFirst();
    }

    public static synchronized void clear() {
        LINES.clear();
    }

    public static synchronized String text() {
        if (LINES.isEmpty()) return "Пока пусто.";
        StringBuilder builder = new StringBuilder();
        for (String line : LINES) {
            if (builder.length() > 0) builder.append('\n');
            builder.append(line);
        }
        return builder.toString();
    }
}
