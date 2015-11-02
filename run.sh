#! /bin/bash

#grunt testsapp --verbose --platform=Android --emuPId=".*emulator64-x86" --avd="Api19" --logFilePath="./TestRunResult.txt" --runtimePath="/Users/erjan/tns-android.tgz" --showEmu=true --modulesPath=/Volumes/distributions/DailyBuilds/NativeScript/tns-modules/Stable/tns-core-modules.tgz

#grunt testsapp --verbose --platform=iOS --logFilePath="./TestRunResult.txt" --runtimePath="/Users/erjan/tns-ios.tgz" --showEmu=true --modulesPath=/Volumes/distributions/DailyBuilds/NativeScript/tns-modules/Stable/tns-core-modules.tgz --avd="'iPhone 6 (9.0) ['"

grunt buildTestsApp --verbose --platform=iOS --logFilePath="./TestRunResult.txt" --runtimePath="/Users/erjan/tns-ios.tgz" --showEmu=true --modulesPath=/Volumes/distributions/DailyBuilds/NativeScript/tns-modules/Stable/tns-core-modules.tgz --avd="'iPhone 6 (9.0) ['"

#grunt testsapp --verbose --platform=iOS --runAppOnly --logFilePath="./TestRunResult.txt" --runtimePath="/Users/erjan/tns-ios.tgz" --showEmu=true --modulesPath=/Volumes/distributions/DailyBuilds/NativeScript/tns-modules/Stable/tns-core-modules.tgz --avd="'iPhone 6 (9.0) ['"
