import { Data, Effect, Layer, pipe, Exit, Array, Option } from "effect"
import { describe, expect, test } from "vitest"

class User extends Data.Class<{
	name: string
}> {}

export class DuplicateUser extends Data.TaggedClass("DuplicateUser")<{
	name: string
}> {}

class UserRepository extends Effect.Tag("UserGateway")<
	UserRepository,
	{
		list: Effect.Effect<User[]>
		create: (user: User) => Effect.Effect<void, DuplicateUser>
	}
>() {}

describe(`Testing failure`, () => {
	const user = new User({ name: "user_name" })

	test(`Creates user`, () =>
		pipe(
			Effect.gen(function* () {
				const result = yield* pipe(
					UserRepository.create(user),
					Effect.zipRight(UserRepository.list),
				)

				expect(result).toStrictEqual<typeof result>([user])
			}),
			Effect.provide(LiveInMemoryUserGateway),
			Effect.runPromise,
		))

	test(`Cannot create a duplicate user`, () =>
		pipe(
			Effect.gen(function* () {
				yield* UserRepository.create(user)

				const result = yield* Effect.exit(UserRepository.create(user))

				expect(result).toStrictEqual(
					Exit.fail(new DuplicateUser({ name: user.name })),
				)
			}),
			Effect.provide(LiveInMemoryUserGateway),
			Effect.runPromise,
		))
})

const LiveInMemoryUserGateway = Layer.effect(
	UserRepository,
	Effect.sync(() => {
		const users: User[] = []
		return UserRepository.of({
			list: Effect.sync(() => users),
			create: user =>
				pipe(
					users,
					Array.findFirst(u => u.name === user.name),
					Option.match({
						onSome: () => Effect.fail(new DuplicateUser({ name: user.name })),
						onNone: () => Effect.sync(() => users.push(user)),
					}),
				),
		})
	}),
)
