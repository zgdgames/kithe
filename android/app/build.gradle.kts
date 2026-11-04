plugins {
    id("com.android.application")
}

android {
    namespace = "com.kithe.browser"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.kithe.browser"
        minSdk = 29
        targetSdk = 34
        versionCode = 111
        versionName = "0.1.11"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// The app's UI is the exact same index.html / renderer.js / style.css the
// desktop version runs — copied in at build time so the two can never drift.
// Only two things are added on the way in: a viewport tag (so the page lays
// out at phone width) and the shim script that provides window.browserAPI.
val webRoot = rootDir.parentFile
tasks.register<Sync>("syncWeb") {
    into("src/main/assets/www")
    from(webRoot) {
        include("style.css", "renderer.js", "internal/**", "img/**")
    }
    from(webRoot) {
        include("index.html")
        filter { line: String ->
            line
                .replace("<meta charset=\"utf-8\" />", "<meta charset=\"utf-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />")
                .replace("<link rel=\"stylesheet\" href=\"style.css\" />", "<link rel=\"stylesheet\" href=\"style.css\" />\n  <link rel=\"stylesheet\" href=\"android.css\" />")
                .replace("<script src=\"renderer.js\"></script>", "<script src=\"android-shim.js\"></script>\n  <script src=\"renderer.js\"></script>")
        }
    }
    from("src/main/shim") {
        include("android-shim.js", "android.css")
    }
    from(File(webRoot, "Extra exclusive URLS")) {
        include("registry.json", "home/**", "snake/**", "igx-assistant/**", "Cyber Track/public/cybertrackfavicon.png", "Fighting Game/Favicon.png", "Fighting Game/kithe/**", "Cyber Track/kithe/**", "Fighting Game/shared/constants.js")
        into("Extra exclusive URLS")
    }
}
tasks.named("preBuild") { dependsOn("syncWeb") }
