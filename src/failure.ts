import { Effect, Data } from "effect"

export class User extends Data.Class<{
	name: string
}> {}

export class DuplicateUser extends Data.TaggedClass("DuplicateUser")<{
	name: string
}> {}

export class UserRepository extends Effect.Tag("UserRepository")<
	UserRepository,
	{
		list: Effect.Effect<User[]>
		create: (user: User) => Effect.Effect<void, DuplicateUser>
	}
>() {}
