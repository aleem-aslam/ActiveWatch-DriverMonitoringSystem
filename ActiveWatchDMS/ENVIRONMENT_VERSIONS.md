# Environment versions (generated 2026-11-07)

Source of npm versions: node_modules (installed)

## Tools on this machine
- Node: 26.8.1   (package.json engines: >= 22.11.0)
- npm: 11.19.0
- Java: java version "17" 2021-09-14 LTS
- JAVA_HOME: C:\Program Files\Java\jdk-17
- ANDROID_HOME / sdk.dir: D:\Android\Sdk

## Android SDK folders installed
- ndk: 26.1.10909125, 27.0.12077973, 27.1.12297006, 28.2.13676358
- build-tools: 36.0.0, 37.0.0
- platforms: android-36, android-37.0
- cmake: 3.22.1

## Gradle / Android project settings
Gradle wrapper:
    distributionUrl=https\://services.gradle.org/distributions/gradle-9.4.1-bin.zip
android/build.gradle (SDK/NDK/Kotlin/AGP):
    buildToolsVersion = "35.0.0"
    minSdkVersion = 26
    compileSdkVersion = 36
    targetSdkVersion = 34
    ndkVersion = "27.1.12297006"
    kotlinVersion = "2.1.20"
    classpath("com.android.tools.build:gradle")
    classpath("org.jetbrains.kotlin:kotlin-gradle-plugin")
    classpath("com.facebook.react:react-native-gradle-plugin")
    classpath('com.google.gms:google-services:4.4.2')
android/app/build.gradle:
    compileSdk rootProject.ext.compileSdkVersion
    ndkVersion rootProject.ext.ndkVersion
    applicationId "com.activewatchdms"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 1
    versionName "1.0"
android/gradle.properties:
    # org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
    org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8
    # https://developer.android.com/topic/libraries/support-library/androidx-rn
    android.useAndroidX=true
    # ./gradlew <task> -PreactNativeArchitectures=x86_64
    reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
    newArchEnabled=true
    hermesEnabled=true
    android.builtInKotlin=false
    android.newDsl=false
    android.useAndroidX=true
    android.enableJetifier=true
    android.native.buildOutput=verbose

## Pinned npm packages
- @react-native-community/geolocation@3.4.0
- @react-native-community/slider@5.2.1
- @react-native-firebase/app@26.4.0
- @react-native-firebase/auth@26.4.0
- @react-native-firebase/database@26.4.0
- @react-native-firebase/firestore@26.4.0
- @react-native-google-signin/google-signin@16.1.5
- @react-native-vector-icons/ionicons@13.1.4
- @react-native/new-app-screen@0.87.1
- @react-navigation/bottom-tabs@7.19.2
- @react-navigation/native@7.4.1
- @react-navigation/native-stack@7.19.2
- axios@1.20.0
- firebase-admin@14.5.0
- jpeg-js@0.4.4
- react@19.2.3
- react-native@0.87.1
- react-native-fast-tflite@3.0.1
- react-native-fs@2.20.0
- react-native-image-resizer@1.4.5
- react-native-nitro-modules@0.37.1
- react-native-safe-area-context@5.10.0
- react-native-screens@4.28.0
- react-native-sound@0.13.0
- react-native-vision-camera@5.2.3
- react-native-vision-camera-resizer@5.2.3
- react-native-vision-camera-worklets@5.2.3
- react-native-worklets@0.13.0
- @babel/core@7.29.7
- @babel/plugin-proposal-nullish-coalescing-operator@7.18.6
- @babel/plugin-proposal-optional-chaining@7.21.0
- @babel/preset-env@7.29.7
- @babel/preset-typescript@7.29.7
- @babel/runtime@7.29.7
- @react-native-community/cli@20.2.0
- @react-native-community/cli-platform-android@20.2.0
- @react-native-community/cli-platform-ios@20.2.0
- @react-native/babel-preset@0.87.1
- @react-native/eslint-config@0.87.1
- @react-native/jest-preset@0.87.1
- @react-native/metro-config@0.87.1
- @react-native/typescript-config@0.87.1
- @types/jest@29.5.14
- @types/react@19.3.0
- @types/react-test-renderer@19.3.0
- eslint@8.57.1
- jest@29.7.0
- prettier@2.8.8
- react-test-renderer@19.2.3
- typescript@6.0.3

## Rebuild recipe
1. Install Node 26.8.1, the Java above, Android SDK/NDK/CMake versions above.
2. `npm ci`   (never `npm install` / `npm update`)
3. `cd android; .\gradlew.bat assembleRelease`
