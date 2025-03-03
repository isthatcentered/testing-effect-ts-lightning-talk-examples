import { Duration, TestClock, Effect, TestContext, Layer, pipe, Clock, Exit, Fiber } from "effect"
import { describe, expect, test } from "vitest"
import { Freeze } from "./time"

describe(`Testing time`, () => {
	describe(`Non blocking`, () => {
		const dependencies = Layer.mergeAll(
			LiveNonBlockingInMemoryFreeze,
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

	describe(`Blocking`, () => {
		const dependencies = Layer.mergeAll(
			LiveBlockingInMemoryFreeze,
			TestContext.TestContext,
		)
		const timeout = Duration.minutes(10)

		test(`Freeze is still active 1s before timeout`, () =>
			pipe(
				Effect.gen(function* () {
					yield* Effect.fork(Freeze.start({ timeout }))

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
					const fiber = yield* pipe(
						 Freeze.start({ timeout }),
						 Effect.exit,
						 Effect.fork
					)

					yield* TestClock.adjust(timeout)

					expect(yield* Freeze.isFrozen).toBe(false)
					 expect(yield * Fiber.join(fiber)).toStrictEqual(Exit.void)
				}),
				Effect.provide(dependencies),
				Effect.runPromise,
			))
	})
})

const LiveNonBlockingInMemoryFreeze = Layer.effect(
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

const LiveBlockingInMemoryFreeze = Layer.effect(
	Freeze,
	Effect.sync(() => {
		let active = false
		return Freeze.of({
			start: params =>
				pipe(
					Effect.sync(() => (active = true)),
					Effect.zipRight(Effect.never),
					Effect.timeoutOption(params.timeout),
					Effect.tap(() => (active = false)),
					Effect.asVoid,
				),
			isFrozen: Effect.sync(() => active),
		})
	}),
)
