import { Link } from "react-router-dom";
import { Bug, BookOpen, LifeBuoy } from "lucide-react";
import { BugReportForm } from "../components/support/BugReportForm.js";

interface Topic {
  question: string;
  answer: React.ReactNode;
}

const topics: Topic[] = [
  {
    question: "What is MayDay, and how do Requests and Offers work?",
    answer: (
      <>
        <p>
          MayDay is a different kind of social network, where the objective
          isn't just communication, but making real world connections between
          people who need help and people who can provide it. Anything you post
          is either a <span className="font-medium">Request</span> (you need
          help) or an <span className="font-medium">Offer</span> (you have
          something to give). Both are browsable on the{" "}
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
        the world we want to live in, and a strategy for getting there. For more
        information, visit{" "}
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
          {topics.map((topic) => (
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
