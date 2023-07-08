// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/** Provides a simple interface to manage a contract-internal PRNG and pull
 * random numbers from it.
 */
abstract contract RandomNumberGenerator {
	uint256 private s_seed = 1;
	uint256 private s_randCounter = 1;

	/** seed the internal PRNG with an arbitrary seed.
	 */
	function _setSeed(bytes32 seed) internal {
		s_seed = uint256(seed);
		// optimisation: nonzero costs less gas to store
		s_randCounter = 1;
	}
	/** reset the internal PRNG to an unusable state.
	 */
	function _resetSeed() internal {
		s_seed = 1;
	}

	/** seed the internal PRNG within the function.
	 */
	modifier withSeed(bytes32 seed) {
		_setSeed(seed);
		_;
		_resetSeed();
	}

	/** ensure the internal PRNG is seeded.
	 */
	function checkSeeded() view internal {
		require(s_seed > 1);
	}

	/** return a distinct, uniformly distributed 256-bit number, and advance the internal PRNG.
	 * reverts if the PRNG is not seeded.
	 */
	function randomUint256() internal returns (uint256) {
		checkSeeded();
		return unsafeRandomUint256();
	}

	/** return a distinct, uniformly distributed number less than limit, and advance the internal PRNG.
	 * reverts if the PRNG is not seeded.
	 */
	function randomUint224(uint224 limit) internal returns (uint224) {
		checkSeeded();
		return unsafeRandomUint224(limit);
	}

	/** return a distinct, uniformly distributed number, and advance the internal PRNG.
	 * Pre-condition: caller must ensure the internal PRNG is seeded
	 */
	function unsafeRandomUint256() internal returns (uint256 random) {
		random = uint256(keccak256(abi.encode(s_seed, s_randCounter)));
		unchecked { // It's not possible to call random enough times
			s_randCounter++;
		}
	}

	/** return a distinct, uniformly distributed number less than limit, and advance the internal PRNG.
	 * Pre-condition: caller must ensure the internal PRNG is seeded
	 */
	function unsafeRandomUint224(uint224 limit) internal returns (uint224) {
		return uint224(unsafeRandomUint256()) % limit;
	}
}
