import { Link } from "react-router-dom";
import { Bug, BookOpen, LifeBuoy, Settings } from "lucide-react";
import { BugReportForm } from "../components/support/BugReportForm.js";

interface Topic {
  question: string;
  answer: React.ReactNode;
}

const generalTopics: Topic[] = [
  {
    question: "What is MayDay?",
    answer: (
      <p>
        MayDay is a different kind of social network, where the objective isn't
        just communication, but making real-world connections between people who
        need help and people who can provide it. It's a tool to help communities
        coordinate and keep track of{" "}
        <span className="font-medium">mutual aid</span> efforts, and to connect
        people to the resources they need to survive and thrive.
      </p>
    ),
  },
  {
    question: "What is mutual aid?",
    answer: (
      <p>
        Mutual aid is a voluntary relationship in which people in community
        exchange resources and services for mutual benefit. It differs from
        charity in that, while charity is a one-way transaction that reinforces
        existing assumptions about power and privilege, mutual aid is based on
        the assumption that everyone has needs that they can not meet on their
        own, and that everyone has something to offer. Mutual aid is not
        transactional, but relational. While the last person you helped may not
        be the one who helps you, you are building a network of care and support
        that benefits everyone involved. Mutual aid is not based on love or pity
        or any other emotional response, but on the understanding that we are
        all interdependent and that our survival and flourishing depends on
        taking care of each other. It is a practice of freedom that prefigures
        the world we want to live in, and a strategy for getting there.
      </p>
    ),
  },
  {
    question: "What do you do with my data?",
    answer: (
      <p>
        MayDay is designed to collect as little data as possible and to keep
        what we do collect as secure as possible. We use industry-standard
        encryption to protect your data, and we never sell or share it with
        third parties. If you ever want to delete your account, you can do so
        from your profile page, and all of your data will be permanently deleted
        from our servers.
      </p>
    ),
  },
  {
    question: "Is there anything I can do to help?",
    answer: (
      <p>
        MayDay is a passion project built by one guy in his spare time, and
        there are a lot of ways you can help out if you're interested! I've made
        all of the code open source, so if you're a developer or designer, you
        can check out the repository at{" "}
        <Link
          to="https://github.com/Nokondi/mayday"
          className="text-mayday-600 hover:underline"
        >
          github.com/Nokondi/mayday
        </Link>{" "}
        and submit a pull request. Hosting the app also costs money, and
        maintenance requires ongoing support, so if you are able to provide
        financial assistance, you can donate through the{" "}
        <Link
          to="https://www.patreon.com/c/MayDayCreative"
          className="text-mayday-600 hover:underline"
        >
          MayDay Patreon
        </Link>
        . Donation tiers start at $1, and every contribution helps keep MayDay
        running. You can follow along with updates about project development,
        and there will be opportunities for supporters to help decide on future
        features and updates. If you're not a developer and don't have money to
        contribute, you can still help by sharing MayDay with your friends and
        family, giving feedback on how to make it better, or even just posting
        your needs and offers to help build the community. The more people use
        it, the more useful it becomes!
      </p>
    ),
  },
  {
    question:
      "Where can I learn more about mutual aid and the philosophy behind MayDay?",
    answer: (
      <p>
        There are a lot of great texts that cover mutual aid and other aspects
        of anarchist philosophy. A few good places to start include:
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>
            <Link
              to="https://www.thriftbooks.com/w/mutual-aid--building-solidarity-during-this-crisis-and-the-next-one/26690066/item/42249298/"
              className="text-mayday-600 hover:underline"
            >
              <i>
                Mutual Aid: Building Solidarity During This Crisis (and the
                Next)
              </i>
              , by Dean Spade
            </Link>
          </li>
          <li>
            <Link
              to="https://theanarchistlibrary.org/library/petr-kropotkin-mutual-aid-a-factor-of-evolution"
              className="text-mayday-600 hover:underline"
            >
              <i>Mutual Aid: A Factor of Evolution</i>, by Peter Kropotkin
            </Link>
          </li>
          <li>
            <Link
              to="https://theanarchistlibrary.org/library/david-graeber-are-you-an-anarchist-the-answer-may-surprise-you"
              className="text-mayday-600 hover:underline"
            >
              <i>Are You An Anarchist? The Answer May Surprise You</i>, by David
              Graeber
            </Link>
          </li>
        </ul>
        For even more resources, visit{" "}
        <Link
          to="https://theanarchistlibrary.org/"
          className="text-mayday-600 hover:underline"
        >
          The Anarchist Library
        </Link>
      </p>
    ),
  },
];

const techTopics: Topic[] = [
  {
    question: "How do Requests and Offers work?",
    answer: (
      <>
        <p>
          Anything you post is either a{" "}
          <span className="font-medium">Request</span> (you need help) or an{" "}
          <span className="font-medium">Offer</span> (you have something to
          give). Both are browsable on the{" "}
          <Link to="/posts" className="text-mayday-600 hover:underline">
            Browse
          </Link>{" "}
          page, visible on the{" "}
          <Link to="/map" className="text-mayday-600 hover:underline">
            Map
          </Link>
          , and — if they have a start time — listed on the{" "}
          <Link to="/calendar" className="text-mayday-600 hover:underline">
            Calendar
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    question: "How do I create a post?",
    answer: (
      <p>
        Click <span className="font-medium">New Post</span> in the header. Pick
        Request or Offer, give it a title and description, choose a category and
        urgency, and optionally attach photos, a location, and a start/end time.
        You can also scope a post to a community you belong to so it is only
        visible to those members, and if you are a member of an organization,
        you can choose to post on behalf of the organization.
      </p>
    ),
  },
  {
    question: "How do I mark a post as fulfilled?",
    answer: (
      <p>
        Open your post, click{" "}
        <span className="font-medium">Mark as Fulfilled</span>, and add the
        people or organizations that helped. This closes the post, and (in a
        feature coming soon) gives points to helpers and tracks their impact
        over time.
      </p>
    ),
  },
  {
    question: "What are Communities and Organizations, and how do they differ?",
    answer: (
      <>
        <p>
          <span className="font-medium">Communities</span> are open groups
          people can either be invited to or request to join (e.g. a
          neighborhood). When you post a request or offer, you can choose to
          make it visible only to people within any of the communities you
          belong to. <span className="font-medium">Organizations</span> are
          invite-only groups that represent a real-world entity (e.g. a food
          bank). Owners and admins can invite members, approve join requests,
          and post on behalf of the group.
        </p>
      </>
    ),
  },
  {
    question: "How do I message someone?",
    answer: (
      <p>
        From any user profile or post, click{" "}
        <span className="font-medium">Message</span>. All conversations live in
        the{" "}
        <Link to="/messages" className="text-mayday-600 hover:underline">
          Messages
        </Link>{" "}
        tab; you'll see a badge in the header whenever you have a new message or
        someone replies to you.
      </p>
    ),
  },
  {
    question: "Someone is acting abusively — what do I do?",
    answer: (
      <p>
        Every post and user profile has a small red flag at the top right
        corner. If you come across a request or offer that is inappropriate, or
        if a user is behaving inappropriately, click on the flag and include any
        details you want to share. Reports go to the admin team for review. If
        someone is in immediate danger, please contact local emergency services
        first.
      </p>
    ),
  },
  {
    question: "I forgot my password or never confirmed my email — what now?",
    answer: (
      <p>
        If you forgot your password, use{" "}
        <Link to="/forgot-password" className="text-mayday-600 hover:underline">
          Forgot your password?
        </Link>{" "}
        on the login page to get a reset link by email. If you never received
        your confirmation email, log in and click{" "}
        <span className="font-medium">Resend confirmation email</span>.
      </p>
    ),
  },
  {
    question: "Is there a way to disable email notifications?",
    answer: (
      <p>
        You can manage your email notification preferences by clicking the{" "}
        <span className="font-medium">Settings</span> button in the top right of
        your profile.
      </p>
    ),
  },
];

export function SupportPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <header className="flex items-start gap-3">
        <LifeBuoy className="w-7 h-7 text-mayday-600 mt-1" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Need Help with MayDay?
          </h1>
          <p className="text-gray-600 mt-1">
            Find quick answers below, or report a bug and we'll take a look.
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
            How to use the site
          </h2>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {techTopics.map((topic) => (
            <details key={topic.question} className="group">
              <summary className="flex justify-between items-center cursor-pointer list-none px-4 py-3 font-medium text-gray-800 hover:bg-gray-50">
                <span>{topic.question}</span>
                <span
                  className="text-gray-400 group-open:rotate-90 transition-transform"
                  aria-hidden="true"
                >
                  ›
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
            General questions about MayDay
          </h2>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {generalTopics.map((topic) => (
            <details key={topic.question} className="group">
              <summary className="flex justify-between items-center cursor-pointer list-none px-4 py-3 font-medium text-gray-800 hover:bg-gray-50">
                <span>{topic.question}</span>
                <span
                  className="text-gray-400 group-open:rotate-90 transition-transform"
                  aria-hidden="true"
                >
                  ›
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
            Report a bug
          </h2>
        </div>
        <p className="text-gray-600 mb-4">
          Found something broken? Tell us what happened and we'll look into it.
        </p>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <BugReportForm />
        </div>
      </section>
    </div>
  );
}
