#ifndef ACCORD_NATIVE_CLOCK_CORE_H
#define ACCORD_NATIVE_CLOCK_CORE_H
#include <stdint.h>
int64_t accord_epoch_microseconds(int64_t seconds, int64_t microseconds);
int accord_current_epoch_microseconds(int64_t *result);
#endif
