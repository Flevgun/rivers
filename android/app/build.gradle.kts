plugins {
    id("com.android.application")
}

android {
    namespace = "app.rivers"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.rivers"
        minSdk = 29
        targetSdk = 35
        versionCode = 10
        versionName = "1.5.10"
        ndk {
            abiFilters += listOf("arm64-v8a", "x86_64")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }

    signingConfigs {
        create("release") {
            storeFile = file("../rivers.keystore")
            storePassword = "rivers-android"
            keyAlias = "rivers"
            keyPassword = "rivers-android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core:1.15.0")
    implementation(files("libs/hev-socks5-tunnel.aar"))
}
