#include "clock_core.h"
#include <sys/time.h>

int64_t accord_epoch_microseconds(int64_t seconds, int64_t microseconds) {
  return seconds * INT64_C(1000000) + microseconds;
}

int accord_current_epoch_microseconds(int64_t *result) {
  struct timeval now;
  if (gettimeofday(&now, 0) != 0) return -1;
  *result = accord_epoch_microseconds((int64_t)now.tv_sec, (int64_t)now.tv_usec);
  return 0;
}
