# Tests PC du cœur algorithmique (g++ ou clang++, C++11)
CXX ?= g++
CXXFLAGS ?= -std=c++11 -O2 -Wall -Wextra -I..
SRC = test_algorithms.cpp ../Format.cpp ../PPGProcessor.cpp ../HeartRate.cpp ../PPGSimulator.cpp \
      ../EEPROMManager.cpp ../Strings.cpp

test_algorithms: $(SRC) ../*.h
	$(CXX) $(CXXFLAGS) -o $@ $(SRC)

run: test_algorithms
	./test_algorithms

clean:
	rm -f test_algorithms results_simulation.csv
