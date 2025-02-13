import {
	Duration,
	TestClock,
	Effect,
	TestContext,
	Layer,
	pipe,
	Clock,
} from "effect"
import { describe, expect, test } from "vitest"
import { Freeze } from "./time"

describe(`Testing time`, () => {
	const dependencies = Layer.mergeAll(
		LiveInMemoryFreeze,
		TestContext.TestContext,
	)
	const timeout = Duration.minutes(10)

	test(`Freeze is still active 1s before timeout`, () =>
		pipe(
			Effect.gen(function* () {
				yield* Freeze.start({ timeout })

				yield* TestClock.adjust(
					pipe(timeout, Duration.subtract(Duration.seconds(1))),
				)

				expect(yield* Freeze.isFrozen).toBe(true)
			}),
			Effect.provide(dependencies),
			Effect.runPromise,
		))

	test(`Freeze expires automatically after timeout`, () =>
		pipe(
			Effect.gen(function* () {
				yield* Freeze.start({ timeout })

				yield* TestClock.adjust(timeout)

				expect(yield* Freeze.isFrozen).toBe(false)
			}),
			Effect.provide(dependencies),
			Effect.runPromise,
		))
})

const LiveInMemoryFreeze = Layer.effect(
	Freeze,
	Effect.sync(() => {
		let expiresAt: undefined | number
		return Freeze.of({
			start: params =>
				pipe(
					Clock.currentTimeMillis,
					Effect.map(now => now + Duration.toMillis(params.timeout)),
					Effect.tap(expiry =>
						Effect.sync(() => {
							expiresAt = expiry
						}),
					),
				),
			isFrozen: pipe(
				Clock.currentTimeMillis,
				Effect.map(now => expiresAt !== undefined && now < expiresAt),
			),
		})
	}),
)
