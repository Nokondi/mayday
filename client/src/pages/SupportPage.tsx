import { Link } from "react-router-dom";
import {
  Bug,
  BookOpen,
  CheckCircle,
  LifeBuoy,
  Settings,
  EllipsisVertical,
  Share,
  Flag,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import { BugReportForm } from "../components/support/BugReportForm.js";

interface Topic {
  id: string;
  question: string;
  answer: React.ReactNode;
}

const strong = (chunks: React.ReactNode) => (
  <span className="font-medium">{chunks}</span>
);

const externalLink = (href: string) => (chunks: React.ReactNode) => (
  <Link to={href} className="text-mayday-600 hover:underline">
    {chunks}
  </Link>
);

const internalLink = (to: string) => (chunks: React.ReactNode) => (
  <Link to={to} className="text-mayday-600 hover:underline">
    {chunks}
  </Link>
);

const italicChunks = (chunks: React.ReactNode) => <i>{chunks}</i>;

export function SupportPage() {
  const intl = useIntl();

  const generalTopics: Topic[] = [
    {
      id: "whatIsMayDay",
      question: intl.formatMessage({
        id: "support.topics.general.whatIsMayDay.question",
        defaultMessage: "What is MayDay?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.general.whatIsMayDay.answer"
            defaultMessage="MayDay is a different kind of social network, where the objective isn't just communication, but making real-world connections between people who need help and people who can provide it. It's a tool to help communities coordinate and keep track of <strong>mutual aid</strong> efforts, and to connect people to the resources they need to survive and thrive."
            values={{ strong }}
          />
        </p>
      ),
    },
    {
      id: "whyMayDay",
      question: intl.formatMessage({
        id: "support.topics.general.whyMayDay.question",
        defaultMessage: "Why MayDay?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.general.whyMayDay.answer"
            defaultMessage={`MayDay is both a call for help and a celebration of community. Ships in distress use the call, "mayday," to signal that they need immediate assistance. May Day is also an ancient spring festival ― a celebration of life and renewal ― and it is the date of International Workers' Day, a day of solidarity and mutual aid. We chose the name MayDay to reflect our mission of connecting people in need with those who can help, while also honoring the spirit of community and solidarity that has been practiced and celebrated for centuries.`}
            values={{ strong }}
          />
        </p>
      ),
    },
    {
      id: "whatIsMutualAid",
      question: intl.formatMessage({
        id: "support.topics.general.whatIsMutualAid.question",
        defaultMessage: "What is mutual aid?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.general.whatIsMutualAid.answer"
            defaultMessage="Mutual aid is a voluntary relationship in which people in community exchange resources and services for mutual benefit. It differs from charity in that, while charity is a one-way transaction that reinforces existing assumptions about power and privilege, mutual aid is based on the assumption that everyone has needs that they can not meet on their own, and that everyone has something to offer. Mutual aid is not transactional, but relational. While the last person you helped may not be the one who helps you, you are building a network of care and support that benefits everyone involved. Mutual aid is not based on love or pity or any other emotional response, but on the understanding that we are all interdependent and that our survival and flourishing depends on taking care of each other. It is a practice of freedom that prefigures the world we want to live in, and a strategy for getting there."
          />
        </p>
      ),
    },
    {
      id: "dataHandling",
      question: intl.formatMessage({
        id: "support.topics.general.dataHandling.question",
        defaultMessage: "What do you do with my data?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.general.dataHandling.answer"
            defaultMessage="MayDay is designed to collect as little data as possible and to keep what we do collect as secure as possible. We use industry-standard encryption to protect your data, and we never sell or share it with third parties. If you ever want to delete your account, you can do so from your profile page, and all of your data will be permanently deleted from our servers."
          />
        </p>
      ),
    },
    {
      id: "howToHelp",
      question: intl.formatMessage({
        id: "support.topics.general.howToHelp.question",
        defaultMessage: "Is there anything I can do to help?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.general.howToHelp.answer"
            defaultMessage="MayDay is a passion project built by one guy in his spare time, and there are a lot of ways you can help out if you're interested! I've made all of the code open source, so if you're a developer or designer, you can check out the repository at <gh>github.com/Nokondi/mayday</gh> and submit a pull request. Hosting the app also costs money, and maintenance requires ongoing support, so if you are able to provide financial assistance, you can donate through the <patreon>MayDay Patreon</patreon>. Donation tiers start at $1, and every contribution helps keep MayDay running. You can follow along with updates about project development, and there will be opportunities for supporters to help decide on future features and updates. If you're not a developer and don't have money to contribute, you can still help by sharing MayDay with your friends and family, giving feedback on how to make it better, or even just posting your needs and offers to help build the community. The more people use it, the more useful it becomes!"
            values={{
              gh: externalLink("https://github.com/Nokondi/mayday"),
              patreon: externalLink("https://www.patreon.com/c/MayDayCreative"),
            }}
          />
        </p>
      ),
    },
    {
      id: "learnMore",
      question: intl.formatMessage({
        id: "support.topics.general.learnMore.question",
        defaultMessage:
          "Where can I learn more about mutual aid and the philosophy behind MayDay?",
      }),
      answer: (
        <>
          <p>
            <FormattedMessage
              id="support.topics.general.learnMore.intro"
              defaultMessage="There are a lot of great texts that cover mutual aid and other aspects of anarchist philosophy. A few good places to start include:"
            />
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <Link
                to="https://www.thriftbooks.com/w/mutual-aid--building-solidarity-during-this-crisis-and-the-next-one/26690066/item/42249298/"
                className="text-mayday-600 hover:underline"
              >
                <FormattedMessage
                  id="support.topics.general.learnMore.bookSpade"
                  defaultMessage="<i>Mutual Aid: Building Solidarity During This Crisis (and the Next)</i>, by Dean Spade"
                  values={{ i: italicChunks }}
                />
              </Link>
            </li>
            <li>
              <Link
                to="https://theanarchistlibrary.org/library/petr-kropotkin-mutual-aid-a-factor-of-evolution"
                className="text-mayday-600 hover:underline"
              >
                <FormattedMessage
                  id="support.topics.general.learnMore.bookKropotkin"
                  defaultMessage="<i>Mutual Aid: A Factor of Evolution</i>, by Peter Kropotkin"
                  values={{ i: italicChunks }}
                />
              </Link>
            </li>
            <li>
              <Link
                to="https://theanarchistlibrary.org/library/david-graeber-are-you-an-anarchist-the-answer-may-surprise-you"
                className="text-mayday-600 hover:underline"
              >
                <FormattedMessage
                  id="support.topics.general.learnMore.bookGraeber"
                  defaultMessage="<i>Are You An Anarchist? The Answer May Surprise You</i>, by David Graeber"
                  values={{ i: italicChunks }}
                />
              </Link>
            </li>
          </ul>
          <p>
            <FormattedMessage
              id="support.topics.general.learnMore.outro"
              defaultMessage="For even more resources, visit <lib>The Anarchist Library</lib>"
              values={{
                lib: externalLink("https://theanarchistlibrary.org/"),
              }}
            />
          </p>
        </>
      ),
    },
  ];

  const techTopics: Topic[] = [
    {
      id: "requestsAndOffers",
      question: intl.formatMessage({
        id: "support.topics.tech.requestsAndOffers.question",
        defaultMessage: "How do Requests and Offers work?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.tech.requestsAndOffers.answer"
            defaultMessage="Anything you post is either a <strong>Request</strong> (you need help) or an <strong>Offer</strong> (you have something to give). Both are browsable on the <browse>Browse</browse> page, visible on the <map>Map</map>, and — if they have a start time — listed on the <calendar>Calendar</calendar>."
            values={{
              strong,
              browse: internalLink("/posts"),
              map: internalLink("/map"),
              calendar: internalLink("/calendar"),
            }}
          />
        </p>
      ),
    },
    {
      id: "createPost",
      question: intl.formatMessage({
        id: "support.topics.tech.createPost.question",
        defaultMessage: "How do I create a post?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.tech.createPost.answer"
            defaultMessage="Click <strong>New Post</strong> in the header. Pick Request or Offer, give it a title and description, choose a category and urgency, and optionally attach photos, a location, and a start/end time. You can also scope a post to a community you belong to so it is only visible to those members, and if you are a member of an organization, you can choose to post on behalf of the organization."
            values={{ strong }}
          />
        </p>
      ),
    },
    {
      id: "markFulfilled",
      question: intl.formatMessage({
        id: "support.topics.tech.markFulfilled.question",
        defaultMessage: "How do I mark a post as fulfilled?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.tech.markFulfilled.answer"
            defaultMessage="Open your post, click <icon></icon> <strong>Mark as Fulfilled</strong>, and add the people or organizations that helped. This closes the post, and (in a feature coming soon) gives points to helpers and tracks their impact over time."
            values={{
              strong,
              icon: () => (
                <CheckCircle
                  className="w-5 h-5 inline-block text-green-500"
                  aria-hidden="true"
                />
              ),
            }}
          />
        </p>
      ),
    },
    {
      id: "communitiesVsOrganizations",
      question: intl.formatMessage({
        id: "support.topics.tech.communitiesVsOrganizations.question",
        defaultMessage:
          "What are Communities and Organizations, and how do they differ?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.tech.communitiesVsOrganizations.answer"
            defaultMessage="<strong>Communities</strong> are open groups people can either be invited to or request to join (e.g. a neighborhood). When you post a request or offer, you can choose to make it visible only to people within any of the communities you belong to. <strong>Organizations</strong> are invite-only groups that represent a real-world entity (e.g. a food bank). Owners and admins can invite members, approve join requests, and post on behalf of the group."
            values={{ strong }}
          />
        </p>
      ),
    },
    {
      id: "messageSomeone",
      question: intl.formatMessage({
        id: "support.topics.tech.messageSomeone.question",
        defaultMessage: "How do I message someone?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.tech.messageSomeone.answer"
            defaultMessage="From any user profile or post, click <icon></icon> <strong>Message</strong>. All conversations live in the <messages>Messages</messages> tab; you'll see a badge in the header whenever you have a new message or someone replies to you."
            values={{
              strong,
              messages: internalLink("/messages"),
              icon: () => (
                <MessageSquare
                  className="w-5 h-5 inline-block text-mayday-600"
                  aria-hidden="true"
                />
              ),
            }}
          />
        </p>
      ),
    },
    {
      id: "reportAbuse",
      question: intl.formatMessage({
        id: "support.topics.tech.reportAbuse.question",
        defaultMessage: "Someone is acting abusively — what do I do?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.tech.reportAbuse.answer"
            defaultMessage="Every post and user profile has a small red flag <icon></icon> at the top right corner. If you come across a request or offer that is inappropriate, or if a user is behaving inappropriately, click on the flag and include any details you want to share. Reports go to the admin team for review. If someone is in immediate danger, please contact local emergency services first."
            values={{
              icon: () => (
                <Flag
                  className="w-5 h-5 inline-block text-red-500"
                  aria-hidden="true"
                />
              ),
            }}
          />
        </p>
      ),
    },
    {
      id: "forgotPassword",
      question: intl.formatMessage({
        id: "support.topics.tech.forgotPassword.question",
        defaultMessage:
          "I forgot my password or never confirmed my email — what now?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.tech.forgotPassword.answer"
            defaultMessage="If you forgot your password, use <forgot>Forgot your password?</forgot> on the login page to get a reset link by email. If you never received your confirmation email, log in and click <strong>Resend confirmation email</strong>."
            values={{
              strong,
              forgot: internalLink("/forgot-password"),
            }}
          />
        </p>
      ),
    },
    {
      id: "manageNotifications",
      question: intl.formatMessage({
        id: "support.topics.tech.manageNotifications.question",
        defaultMessage: "How do I manage email and push notifications?",
      }),
      answer: (
        <p>
          <FormattedMessage
            id="support.topics.tech.manageNotifications.answer"
            defaultMessage="You can manage your email and push notification preferences by clicking the <icon></icon> <strong>Settings</strong> button in the top right of your profile."
            values={{
              strong,
              icon: () => (
                <Settings className="w-5 h-5 inline-block" aria-hidden="true" />
              ),
            }}
          />
        </p>
      ),
    },
    {
      id: "downloadMayday",
      question: intl.formatMessage({
        id: "support.topics.tech.downloadMayday.question",
        defaultMessage: "How do I download MayDay on my phone or computer?",
      }),
      answer: (
        <>
          <p>
            <FormattedMessage
              id="support.topics.tech.downloadMayday.intro"
              defaultMessage="MayDay is a progressive web app (PWA), which means you can add it to your home screen and use it like a native app without needing to go to an app store. To add MayDay to your home screen, follow these instructions:"
            />
          </p>
          <p className="font-medium">
            <FormattedMessage
              id="support.topics.tech.downloadMayday.androidHeading"
              defaultMessage="On Android:"
            />
          </p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.androidStep1"
                defaultMessage="Open the site in your mobile browser."
              />
            </li>
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.androidStep2"
                defaultMessage="Tap the <icon></icon> menu button at the top right corner."
                values={{
                  icon: () => (
                    <EllipsisVertical
                      className="w-5 h-5 inline-block"
                      aria-hidden="true"
                    />
                  ),
                }}
              />
            </li>
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.androidStep3"
                defaultMessage={`Select "Add to Home Screen" from the menu.`}
              />
            </li>
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.androidStep4"
                defaultMessage="Follow the prompts to add MayDay to your home screen."
              />
            </li>
          </ol>
          <p className="font-medium">
            <FormattedMessage
              id="support.topics.tech.downloadMayday.iosHeading"
              defaultMessage="On iOS:"
            />
          </p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.iosStep1"
                defaultMessage="Open the site in your mobile browser."
              />
            </li>
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.iosStep2"
                defaultMessage="Tap the <icon></icon> share button at the bottom of the screen."
                values={{
                  icon: () => (
                    <Share
                      className="w-5 h-5 inline-block"
                      aria-hidden="true"
                    />
                  ),
                }}
              />
            </li>
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.iosStep3"
                defaultMessage={`Select "Add to Home Screen" from the menu.`}
              />
            </li>
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.iosStep4"
                defaultMessage="Follow the prompts to add MayDay to your home screen."
              />
            </li>
          </ol>
          <p className="font-medium">
            <FormattedMessage
              id="support.topics.tech.downloadMayday.windowsHeading"
              defaultMessage="On Windows:"
            />
          </p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.windowsStep1"
                defaultMessage="Open the site in Chrome."
              />
            </li>
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.windowsStep2"
                defaultMessage="Click the <icon></icon> menu button at the top right corner."
                values={{
                  icon: () => (
                    <EllipsisVertical
                      className="w-5 h-5 inline-block"
                      aria-hidden="true"
                    />
                  ),
                }}
              />
            </li>
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.windowsStep3"
                defaultMessage={`Select "Cast, save, and share" from the menu.`}
              />
            </li>
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.windowsStep4"
                defaultMessage={`Select "Install MayDay Mutual Aid Hub" from the submenu.`}
              />
            </li>
            <li>
              <FormattedMessage
                id="support.topics.tech.downloadMayday.windowsStep5"
                defaultMessage="Follow the prompts to add MayDay to your home screen."
              />
            </li>
          </ol>
        </>
      ),
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <header className="flex items-start gap-3">
        <LifeBuoy className="w-7 h-7 text-mayday-600 mt-1" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            <FormattedMessage
              id="support.page.heading"
              defaultMessage="Need Help with MayDay?"
            />
          </h1>
          <p className="text-gray-600 mt-1">
            <FormattedMessage
              id="support.page.subtitle"
              defaultMessage="Find quick answers below, or report a bug and we'll take a look."
            />
          </p>
        </div>
      </header>

      <section aria-labelledby="how-to-use-heading">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-mayday-600" aria-hidden="true" />
          <h2
            id="how-to-use-heading"
            className="text-xl font-semibold text-gray-900"
          >
            <FormattedMessage
              id="support.page.howToUseHeading"
              defaultMessage="How to use the site"
            />
          </h2>
        </div>
        <div className="bg-white rounded-lg border border-mayday-200 divide-y divide-gray-200">
          {techTopics.map((topic) => (
            <details key={topic.id} className="group">
              <summary className="flex justify-between items-center cursor-pointer list-none px-4 py-3 font-medium text-gray-800 hover:bg-gray-50">
                <span>{topic.question}</span>
                <span
                  className="text-gray-500 group-open:rotate-90 transition-transform"
                  aria-hidden="true"
                >
                  <ChevronRight className="w-4 h-4" />
                </span>
              </summary>
              <div className="px-4 pb-4 text-gray-700 space-y-2">
                {topic.answer}
              </div>
            </details>
          ))}
        </div>
      </section>
      <section aria-labelledby="general-questions-heading">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-mayday-600" aria-hidden="true" />
          <h2
            id="general-questions-heading"
            className="text-xl font-semibold text-gray-900"
          >
            <FormattedMessage
              id="support.page.generalQuestionsHeading"
              defaultMessage="General questions about MayDay"
            />
          </h2>
        </div>
        <div className="bg-white rounded-lg border border-mayday-200 divide-y divide-gray-200">
          {generalTopics.map((topic) => (
            <details key={topic.id} className="group">
              <summary className="flex justify-between items-center cursor-pointer list-none px-4 py-3 font-medium text-gray-800 hover:bg-gray-50">
                <span>{topic.question}</span>
                <span
                  className="text-gray-500 group-open:rotate-90 transition-transform"
                  aria-hidden="true"
                >
                  <ChevronRight className="w-4 h-4" />
                </span>
              </summary>
              <div className="px-4 pb-4 text-gray-700 space-y-2">
                {topic.answer}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="bug-report-heading">
        <div className="flex items-center gap-2 mb-3">
          <Bug className="w-5 h-5 text-mayday-600" aria-hidden="true" />
          <h2
            id="bug-report-heading"
            className="text-xl font-semibold text-gray-900"
          >
            <FormattedMessage
              id="support.page.bugReportHeading"
              defaultMessage="Report a bug"
            />
          </h2>
        </div>
        <p className="text-gray-600 mb-4">
          <FormattedMessage
            id="support.page.bugReportIntro"
            defaultMessage="Found something broken? Tell us what happened and we'll look into it."
          />
        </p>
        <div className="bg-white rounded-lg border border-mayday-200 p-6">
          <BugReportForm />
        </div>
      </section>
    </div>
  );
}
