const fs = require("node:fs");
const path = require("node:path");
const PE = require("pe-library");
const ResEdit = require("resedit");

module.exports = async function stampIcon(context) {
  if (context.electronPlatformName !== "win32") return;
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, "icon.ico")));
  const icons = iconFile.icons.map((item) => item.data);
  const exe = PE.NtExecutable.from(fs.readFileSync(exePath));
  const res = PE.NtExecutableResource.from(exe);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const ids = groups.length ? [...new Set(groups.map((entry) => entry.id))] : [1];
  for (const id of ids) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, 1033, icons);
  }
  res.outputResource(exe);
  const next = path.join(context.appOutDir, "Rivers.stamped.exe");
  fs.writeFileSync(next, Buffer.from(exe.generate()));
  fs.rmSync(exePath);
  fs.renameSync(next, exePath);
};
