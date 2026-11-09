cmake_minimum_required(VERSION 3.22.1)
project(accord_native_clock C)
add_library(accord_native_clock SHARED clock_core.c clock_jni.c)
