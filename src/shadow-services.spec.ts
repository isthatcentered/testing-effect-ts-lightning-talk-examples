import { Effect, Context, Layer, pipe } from "effect"
import { describe, expect, test } from "vitest"
import {
	sendBuySubscriptionEmail,
	UserRepository,
	User,
	Mailer,
	Email,
	makeEmailAddress,
	EmailAddress,
} from "./shadow-services"

describe(`Shadow services`, () => {
	const subscribedUser = new User({
		email: makeEmailAddress("subscribed_user_email"),
		hasSubscription: true,
	})

	const nonSubscribedUser = new User({
		email: makeEmailAddress("non_subscribed_user_email"),
		hasSubscription: false,
	})

	test(`Sends email to non paying users`, () =>
		pipe(
			Effect.gen(function* () {
				yield* UserRepository.create(nonSubscribedUser)

				yield* sendBuySubscriptionEmail

				expect(yield* TestMailer.sentEmailTo(nonSubscribedUser.email)).toBe(
					true,
				)
			}),
			Effect.provide(
				Layer.mergeAll(LiveInMemoryUserRepository, LiveTestMailer),
			),
			Effect.runPromise,
		))

	test(`Doesn't send "buy subscription" email to paid users`, () =>
		pipe(
			Effect.gen(function* () {
				yield* UserRepository.create(subscribedUser)

				yield* sendBuySubscriptionEmail

				expect(yield* TestMailer.sentEmailTo(subscribedUser.email)).toBe(false)
			}),
			Effect.provide(
				Layer.mergeAll(LiveInMemoryUserRepository, LiveTestMailer),
			),
			Effect.runPromise,
		))
})

class TestMailer extends Effect.Tag("TestMailer")<
	TestMailer,
	{
		sentEmailTo: (email: EmailAddress) => Effect.Effect<void>
	} & Context.Tag.Service<Mailer>
>() {}

const makeTestMailer = Effect.sync(() => {
	const sentMails: Email<any>[] = []
	return TestMailer.of({
		sendEmail: email => Effect.sync(() => sentMails.push(email)),
		sentEmailTo: email =>
			Effect.sync(() => sentMails.some(mail => mail.recipient === email)),
	})
})

const LiveTestMailer = Layer.unwrapEffect(
	pipe(
		makeTestMailer,
		Effect.map(fakeMailer =>
			Layer.mergeAll(
				Layer.succeed(Mailer, fakeMailer),
				Layer.succeed(TestMailer, fakeMailer),
			),
		),
	),
)
const LiveInMemoryUserRepository = Layer.effect(
	UserRepository,
	Effect.sync(() => {
		const users: User[] = []
		return UserRepository.of({
			list: Effect.sync(() => users),
			create: user => Effect.sync(() => users.push(user)),
		})
	}),
)
