cmake_minimum_required(VERSION 3.22.1)

project(appmodules)

set(NITRO_HEADERS
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../node_modules/react-native-nitro-modules/android/build/headers"
)

include_directories(
    ${NITRO_HEADERS}
)