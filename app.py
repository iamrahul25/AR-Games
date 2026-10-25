"""Developer helper menu for the AR Games Expo app.

Usage: python app.py
"""

import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ANDROID_DIR = ROOT / "android"
BUILT_APK = ANDROID_DIR / "app" / "build" / "outputs" / "apk" / "release" / "app-release.apk"
DEBUG_APK = ANDROID_DIR / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
RELEASE_DIR = ROOT / "release"
RELEASE_APK = RELEASE_DIR / "release-app.apk"
POSE_MODULE_DIR = ROOT / "modules" / "pose-landmarker"
IS_WINDOWS = os.name == "nt"
MIN_JAVA_MAJOR = 17
# AGP's default CMake; no native dependency pins another version.
ANDROID_CMAKE_VERSION = "3.22.1"
MIN_NINJA_VERSION = (1, 12)
RULE = "=" * 50
PREBUILD_HINT = "Run: npx expo prebuild --platform android"


def run(cmd, cwd=ROOT, check=True, capture=False):
    """Run a command, streaming output unless capture=True. Returns CompletedProcess."""
    print(f"\n> {' '.join(str(c) for c in cmd)}")
    return subprocess.run(
        [str(c) for c in cmd],
        cwd=cwd,
        check=check,
        text=True,
        capture_output=capture,
        # npx / gradlew are .cmd/.bat scripts on Windows and need the shell to resolve
        shell=IS_WINDOWS,
    )


def android_package():
    with open(ROOT / "app.json", encoding="utf-8") as f:
        return json.load(f)["expo"]["android"]["package"]


def sdk_root():
    for var in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        value = os.environ.get(var)
        if value and Path(value).is_dir():
            return Path(value)
    default = Path(os.environ.get("LOCALAPPDATA", "")) / "Android" / "Sdk"
    if default.is_dir():
        return default
    raise RuntimeError("Android SDK not found. Set ANDROID_HOME to your SDK path.")


def sdk_tool(subdir, name):
    exe = sdk_root() / subdir / (f"{name}.exe" if IS_WINDOWS else name)
    if not exe.is_file():
        raise RuntimeError(f"{name} not found at {exe}")
    return exe


# ---------------------------------------------------------------------------
# 1. Start the application
# ---------------------------------------------------------------------------
def start_app():
    print(
        "\nScan the QR code with your phone's camera (not Expo Go) to open the AR Games development build."
        "\nThe phone must be on the same Wi-Fi as this PC. Install the build first with option 4."
    )
    try:
        run(["npx", "expo", "start"], check=False)
    except KeyboardInterrupt:
        print("\nExpo dev server stopped.")


# ---------------------------------------------------------------------------
# Preflight checks (cheap checks for what Gradle would only discover minutes in)
# ---------------------------------------------------------------------------
class Report:
    def __init__(self):
        self.problems = []
        self.warnings = []

    @staticmethod
    def _hint(hint):
        for line in [hint] if isinstance(hint, str) else hint or []:
            print(f"       {line}")

    def section(self, title):
        print(f"\n{title}")

    def ok(self, message):
        print(f"  ✅ {message}")

    def warn(self, message, hint=None):
        self.warnings.append(message)
        print(f"  ⚠️  {message}")
        self._hint(hint)

    def fail(self, message, hint=None):
        self.problems.append(message)
        print(f"  ❌ {message}")
        self._hint(hint)


def capture(cmd, cwd=ROOT):
    """Run a command quietly. Returns (exit_code, combined_output), or (None, '') if not found."""
    try:
        result = subprocess.run([str(c) for c in cmd], cwd=cwd, text=True, capture_output=True)
    except OSError:
        return None, ""
    return result.returncode, f"{result.stdout}\n{result.stderr}".strip()


def read_properties(path):
    """Minimal Java .properties reader (enough for local.properties)."""
    if not path.is_file():
        return {}
    props = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line[0] in "#!":
            continue
        match = re.match(r"((?:\\.|[^=:\s\\])+)\s*[=:\s]?\s*(.*)", line)
        if match:
            key, value = (re.sub(r"\\(.)", r"\1", g) for g in match.groups())
            props[key] = value
    return props


def check_project(report):
    report.section("Project")

    try:
        json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        report.ok("package.json")
    except (OSError, json.JSONDecodeError) as e:
        report.fail("package.json is missing or invalid", str(e))

    package = None
    try:
        package = android_package()
        report.ok(f"app.json (android.package: {package})")
    except (OSError, KeyError, json.JSONDecodeError) as e:
        report.fail("app.json is missing or has no expo.android.package", str(e))

    if not ANDROID_DIR.is_dir():
        report.warn("android/ folder not found yet", "The APK build generates it with expo prebuild.")
        return

    gradlew = "gradlew.bat" if IS_WINDOWS else "gradlew"
    required = [
        f"android/{gradlew}",
        "android/settings.gradle",
        "android/build.gradle",
        "android/app/build.gradle",
        "android/gradle/wrapper/gradle-wrapper.properties",
    ]
    missing = [f for f in required if not (ROOT / f).is_file()]
    if missing:
        report.fail(f"Android project incomplete, missing: {', '.join(missing)}",
                    f"Delete android/ and regenerate it. {PREBUILD_HINT}")
        return
    report.ok("Android project and Gradle wrapper")

    app_gradle = (ANDROID_DIR / "app" / "build.gradle").read_text(encoding="utf-8")
    match = re.search(r"applicationId\s+['\"]([^'\"]+)['\"]", app_gradle)
    if package and match and match.group(1) != package:
        report.warn(f"android/app/build.gradle applicationId ({match.group(1)}) differs from app.json ({package})",
                    f"The android/ folder may be stale. {PREBUILD_HINT}")

    # Release builds are signed with the debug keystore until an upload keystore is set up.
    if (ANDROID_DIR / "app" / "debug.keystore").is_file():
        report.ok("Signing: android/app/debug.keystore (fine for sideloading, not for the Play Store)")
    else:
        report.fail("android/app/debug.keystore not found", PREBUILD_HINT)


def check_native_module(report):
    report.section("Pose landmarker module")

    generated = POSE_MODULE_DIR / "nitrogen" / "generated" / "android"
    if generated.is_dir() and any(generated.iterdir()):
        report.ok("Nitrogen generated code (nitrogen/generated/android)")
    else:
        report.fail("Nitrogen generated code is missing", "Run: npm run specs")

    models = sorted((POSE_MODULE_DIR / "models").glob("*.task"))
    if models:
        report.ok(f"MediaPipe models: {', '.join(m.name for m in models)}")
    else:
        report.fail("No MediaPipe .task model in modules/pose-landmarker/models",
                    "The app cannot track poses without it.")


def check_toolchain(report):
    report.section("Toolchain")

    node_script = (
        "const v=process.versions.node;let r=null,ok=true;"
        "try{r=require('react-native/package.json').engines.node;ok=require('semver').satisfies(v,r)}catch(e){}"
        "console.log(JSON.stringify({v,r,ok}))"
    )
    code, out = capture(["node", "-e", node_script])
    if code is None:
        report.fail("Node.js not found", "Install Node.js and make sure it is on PATH.")
    else:
        node = json.loads(out.splitlines()[-1])
        if node["ok"]:
            report.ok(f"Node.js {node['v']}")
        else:
            report.fail(f"Node.js {node['v']} does not satisfy react-native's \"{node['r']}\"")

    java_exe = "java.exe" if IS_WINDOWS else "java"
    java_home = os.environ.get("JAVA_HOME")
    if java_home and not (Path(java_home) / "bin" / java_exe).is_file():
        report.fail(f"JAVA_HOME points to an invalid JDK: {java_home}",
                    f"Set JAVA_HOME to a JDK {MIN_JAVA_MAJOR}+ install folder.")
    else:
        java = Path(java_home) / "bin" / java_exe if java_home else "java"
        code, out = capture([java, "-version"])
        match = re.search(r'version "(\d+)(?:\.(\d+))?', out)
        if code is None or not match:
            report.fail("Java not found", f"Install JDK {MIN_JAVA_MAJOR}+ and set JAVA_HOME.")
        else:
            major = int(match.group(2) if match.group(1) == "1" else match.group(1))
            if major < MIN_JAVA_MAJOR:
                report.fail(f"Java {major} found, but Gradle needs JDK {MIN_JAVA_MAJOR}+",
                            f"Current: {out.splitlines()[0]}")
            else:
                version = re.search(r'"([^"]+)"', out.splitlines()[0])
                report.ok(f"Java {version.group(1) if version else major}")

    sdk_dir = (read_properties(ANDROID_DIR / "local.properties").get("sdk.dir")
               or os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT"))
    if not sdk_dir:
        report.fail("Android SDK location not set", "Set ANDROID_HOME, or sdk.dir in android/local.properties.")
    elif not (Path(sdk_dir) / "platforms").is_dir():
        report.fail(f"Android SDK not found at {sdk_dir}", "Install the SDK via Android Studio and fix ANDROID_HOME.")
    else:
        report.ok(f"Android SDK ({sdk_dir})")
        if not (Path(sdk_dir) / "licenses" / "android-sdk-license").is_file():
            report.warn("Android SDK licenses not accepted", "Run: sdkmanager --licenses")


def check_dependencies(report):
    report.section("Dependencies")
    versions = {}
    for pkg in ("expo", "react-native"):
        try:
            manifest = ROOT / "node_modules" / pkg / "package.json"
            versions[pkg] = json.loads(manifest.read_text(encoding="utf-8"))["version"]
        except (OSError, KeyError, json.JSONDecodeError):
            pass
    missing = [pkg for pkg in ("expo", "react-native") if pkg not in versions]
    if missing:
        report.fail(f"Not installed: {', '.join(missing)}", "Run: npm install")
    else:
        report.ok(f"expo {versions['expo']}, react-native {versions['react-native']}")


def windows_long_paths_enabled():
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\FileSystem") as key:
            return winreg.QueryValueEx(key, "LongPathsEnabled")[0] == 1
    except OSError:
        return False


def check_long_paths(report):
    """Native object directories nest the absolute source path inside .cxx/ and exceed 260 characters,
    which ninja can only create with Windows long paths enabled and a long-path-aware ninja (1.12+)."""
    if not IS_WINDOWS:
        return
    report.section("Windows long paths (native C++ build)")

    if windows_long_paths_enabled():
        report.ok("LongPathsEnabled = 1")
    else:
        report.fail("Windows long path support is disabled", [
            "In an Administrator PowerShell run:",
            "  New-ItemProperty -Path HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem "
            "-Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force",
            "then open a new terminal.",
        ])

    try:
        ninja = sdk_root() / "cmake" / ANDROID_CMAKE_VERSION / "bin" / "ninja.exe"
    except RuntimeError:
        return
    if not ninja.is_file():
        report.warn(f"{ninja} not found", "Gradle installs CMake on first build; rerun preflight afterwards.")
        return
    code, out = capture([ninja, "--version"])
    match = re.match(r"(\d+)\.(\d+)", out)
    version = (int(match.group(1)), int(match.group(2))) if code == 0 and match else (0, 0)
    if version >= MIN_NINJA_VERSION:
        report.ok(f"ninja {out.strip()} (CMake {ANDROID_CMAKE_VERSION})")
    else:
        report.fail(f"ninja {out.strip() or '?'} in CMake {ANDROID_CMAKE_VERSION} does not support long paths", [
            "Replace it with ninja 1.12+ from https://github.com/ninja-build/ninja/releases (ninja-win.zip):",
            f"  {ninja}",
        ])


def run_preflight():
    """Returns True if the release build can be started."""
    report = Report()
    print(f"\n{RULE}\n  🔍 PRE-FLIGHT CHECKS (RELEASE)\n{RULE}")

    check_project(report)
    check_native_module(report)
    check_toolchain(report)
    check_dependencies(report)
    check_long_paths(report)

    count = len(report.warnings)
    warning_note = f" ({count} warning{'s' if count != 1 else ''})" if count else ""
    if report.problems:
        count = len(report.problems)
        print(f"\n{RULE}\n  ❌ PREFLIGHT FAILED: {count} problem{'s' if count != 1 else ''}{warning_note}\n{RULE}")
        return False
    print(f"\n{RULE}\n  ✅ PREFLIGHT PASSED{warning_note}\n{RULE}")
    return True


# ---------------------------------------------------------------------------
# 2. Build release APK
# ---------------------------------------------------------------------------
def build_release_apk():
    if not run_preflight():
        raise RuntimeError("Fix the issues above. Gradle build was NOT started.")

    if not ANDROID_DIR.is_dir():
        print("android/ folder not found, generating it with expo prebuild...")
        run(["npx", "expo", "prebuild", "--platform", "android"])

    gradlew = ANDROID_DIR / ("gradlew.bat" if IS_WINDOWS else "gradlew")
    if BUILT_APK.exists():
        BUILT_APK.unlink()

    run([gradlew, "assembleRelease"], cwd=ANDROID_DIR)

    if not BUILT_APK.is_file():
        raise RuntimeError(f"Build finished but APK not found at {BUILT_APK}")

    RELEASE_DIR.mkdir(exist_ok=True)
    shutil.copy2(BUILT_APK, RELEASE_APK)
    size_mb = RELEASE_APK.stat().st_size / (1024 * 1024)
    print(f"\nRelease APK ready: {RELEASE_APK} ({size_mb:.1f} MB)")


# ---------------------------------------------------------------------------
# 3. Run APK in emulator
# ---------------------------------------------------------------------------
def running_emulators(adb):
    out = run([adb, "devices"], capture=True).stdout
    return [
        line.split()[0]
        for line in out.splitlines()[1:]
        if line.startswith("emulator-") and line.split()[-1] == "device"
    ]


def pick_avd(emulator):
    out = run([emulator, "-list-avds"], capture=True).stdout
    avds = [line.strip() for line in out.splitlines() if line.strip() and not line.startswith("INFO")]
    if not avds:
        raise RuntimeError("No Android Virtual Devices found. Create one in Android Studio > Device Manager.")
    if len(avds) == 1:
        return avds[0]

    print("\nAvailable emulators:")
    for i, name in enumerate(avds, 1):
        print(f"  {i}. {name}")
    while True:
        choice = input("Select emulator number: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(avds):
            return avds[int(choice) - 1]
        print("Invalid choice.")


def boot_emulator(adb, emulator, timeout=300):
    avd = pick_avd(emulator)
    print(f"\nStarting emulator '{avd}'...")
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS if IS_WINDOWS else 0
    subprocess.Popen(
        [str(emulator), "-avd", avd],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=flags,
        start_new_session=not IS_WINDOWS,
    )

    run([adb, "wait-for-device"])
    print("Waiting for emulator to finish booting...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        result = run([adb, "shell", "getprop", "sys.boot_completed"], check=False, capture=True)
        if result.stdout.strip() == "1":
            print("Emulator booted.")
            return
        time.sleep(3)
    raise RuntimeError("Timed out waiting for the emulator to boot.")


def ensure_emulator(adb):
    """Returns the serial of a running emulator, booting one first if needed."""
    devices = running_emulators(adb)
    if not devices:
        boot_emulator(adb, sdk_tool("emulator", "emulator"))
        devices = running_emulators(adb)
    serial = devices[0]
    print(f"\nUsing emulator: {serial}")
    return serial


def is_installed(adb, serial, package):
    out = run([adb, "-s", serial, "shell", "pm", "list", "packages", package], capture=True).stdout
    return f"package:{package}" in out.split()


def launch_app(adb, serial, package):
    run([adb, "-s", serial, "shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1"],
        capture=True)
    print(f"\nLaunched {package} on {serial}.")


def run_in_emulator():
    if not RELEASE_APK.is_file():
        raise RuntimeError(f"{RELEASE_APK} not found. Build it first with option 2.")

    adb = sdk_tool("platform-tools", "adb")
    serial = ensure_emulator(adb)
    run([adb, "-s", serial, "install", "-r", RELEASE_APK])
    launch_app(adb, serial, android_package())


# ---------------------------------------------------------------------------
# 6. Launch the installed app in emulator
# ---------------------------------------------------------------------------
def launch_in_emulator():
    """Opens the app already installed on the emulator, without rebuilding or reinstalling."""
    adb = sdk_tool("platform-tools", "adb")
    serial = ensure_emulator(adb)
    package = android_package()
    if not is_installed(adb, serial, package):
        if not RELEASE_APK.is_file():
            raise RuntimeError(f"{package} is not installed and {RELEASE_APK} not found. Build it first with option 2.")
        print(f"{package} is not installed yet, installing {RELEASE_APK.name}...")
        run([adb, "-s", serial, "install", "-r", RELEASE_APK])
    launch_app(adb, serial, package)


# ---------------------------------------------------------------------------
# 4. Install development build
# ---------------------------------------------------------------------------
def install_dev_build():
    print(
        "\nConnect your phone over USB with USB debugging enabled (or start an emulator)."
        "\nThis builds and installs the AR Games development build, which is what the QR code opens."
    )
    run(["npx", "expo", "run:android", "--device"])


# ---------------------------------------------------------------------------
# 7. Run development build in emulator (no native build)
# ---------------------------------------------------------------------------
def is_debuggable(adb, serial, package):
    """The release APK shares the package name but cannot connect to Metro; only debug builds can."""
    out = run([adb, "-s", serial, "shell", "dumpsys", "package", package], capture=True).stdout
    return "DEBUGGABLE" in out


def run_dev_in_emulator():
    """Starts Metro and opens the development build on the emulator, building it only if it isn't installed."""
    adb = sdk_tool("platform-tools", "adb")
    serial = ensure_emulator(adb)
    package = android_package()

    if is_installed(adb, serial, package) and is_debuggable(adb, serial, package):
        cmd = ["npx", "expo", "start", "--android", "--dev-client"]
    elif DEBUG_APK.is_file():
        print(f"Development build not installed on {serial}, installing {DEBUG_APK.name} without rebuilding...")
        cmd = ["npx", "expo", "run:android", "--binary", DEBUG_APK]
    else:
        print(
            f"\nNo development build on {serial} yet, so the native code has to be compiled once."
            "\nThe first build takes several minutes; after that this option opens the app without building."
        )
        cmd = ["npx", "expo", "run:android"]

    try:
        run(cmd, check=False)
    except KeyboardInterrupt:
        print("\nExpo dev server stopped.")


# ---------------------------------------------------------------------------
# Menu
# ---------------------------------------------------------------------------
OPTIONS = {
    "1": ("Start the application (npx expo start)", start_app),
    "2": ("Create release APK (release/release-app.apk)", build_release_apk),
    "3": ("Run the APK in emulator", run_in_emulator),
    "4": ("Install development build on phone/emulator (npx expo run:android --device)", install_dev_build),
    "5": ("Run preflight checks (before building the APK)", run_preflight),
    "6": ("Launch the app in emulator (no rebuild or reinstall)", launch_in_emulator),
    "7": ("Run development build live in emulator (builds only the first time)", run_dev_in_emulator),
}


def main():
    while True:
        print("\n========== AR Games ==========")
        for key, (label, _) in OPTIONS.items():
            print(f"  {key}. {label}")
        print("  0. Exit")
        choice = input("Choose an option: ").strip()

        if choice == "0":
            print("Bye!")
            return
        if choice not in OPTIONS:
            print("Invalid option, try again.")
            continue

        try:
            OPTIONS[choice][1]()
        except subprocess.CalledProcessError as e:
            print(f"\nCommand failed with exit code {e.returncode}.")
            if e.stderr:
                print(e.stderr)
        except RuntimeError as e:
            print(f"\nError: {e}")
        except KeyboardInterrupt:
            print("\nCancelled.")


if __name__ == "__main__":
    # Emoji in the preflight output would crash a cp1252 console or pipe on Windows.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print("\nBye!")
        sys.exit(0)
