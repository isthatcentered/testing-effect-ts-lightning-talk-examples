import {
	Brand,
	Data,
	Schema,
	Effect,
	Context,
	Layer,
	pipe,
	Array,
} from "effect"
import { describe, expect, test } from "vitest"

type EmailAddress = Brand.Branded<string, "EMAIL_ADDRES">
const makeEmailAddress = Brand.nominal<EmailAddress>()

class Mailable<A> extends Data.Class<{
	subject: string
	body: string
	variables: Schema.Schema<A>
}> {}

class Email<A> extends Data.Class<{
	mailable: Mailable<A>
	recipient: EmailAddress
	variables: A
}> {}

class Mailer extends Effect.Tag("Mailer")<
	Mailer,
	{ sendEmail(email: Email<any>): Effect.Effect<void> }
>() {}

class User extends Data.Class<{
	email: EmailAddress
	hasSubscription: boolean
}> {}

class UserRepository extends Effect.Tag("UserGateway")<
	UserRepository,
	{
		list: Effect.Effect<User[]>
		create: (user: User) => Effect.Effect<void>
	}
>() {}

const BuySubscriptionMailable = new Mailable({
	subject: "Buy subscription",
	body: "Pretty please",
	variables: Schema.Void,
})

const sendBuySubscriptionEmail = pipe(
	UserRepository.list,
	Effect.flatMap(users =>
		pipe(
			users,
			Array.filter(u => !u.hasSubscription),
			Array.map(
				u =>
					new Email({
						mailable: BuySubscriptionMailable,
						recipient: u.email,
						variables: undefined,
					}),
			),
			Effect.forEach(email => Mailer.sendEmail(email)),
		),
	),
)

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
			Effect.provide(Layer.mergeAll(LiveInMemoryUserGateway, LiveTestMailer)),
			Effect.runPromise,
		))

	test(`Doesn't send "buy subscription" email to paid users`, () =>
		pipe(
			Effect.gen(function* () {
				yield* UserRepository.create(subscribedUser)

				yield* sendBuySubscriptionEmail

				expect(yield* TestMailer.sentEmailTo(subscribedUser.email)).toBe(false)
			}),
			Effect.provide(Layer.mergeAll(LiveInMemoryUserGateway, LiveTestMailer)),
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
const LiveInMemoryUserGateway = Layer.effect(
	UserRepository,
	Effect.sync(() => {
		const users: User[] = []
		return UserRepository.of({
			list: Effect.sync(() => users),
			create: user => Effect.sync(() => users.push(user)),
		})
	}),
)
