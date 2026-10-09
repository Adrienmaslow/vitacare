# Banc d'émulation simavr (Linux : apt install simavr libsimavr-dev libelf-dev)
CC ?= gcc
CFLAGS ?= -O2 -Wall -Wno-unused-result
cardio_avr_sim: cardio_avr_sim.c
	$(CC) $(CFLAGS) -o $@ $< -lsimavr -lelf -lm

clean:
	rm -f cardio_avr_sim
