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
        On the{" "}
        <Link to="/login" className="text-mayday-600 hover:underline">
          login page
        </Link>
        , use <span className="font-medium">Resend confirmation email</span> to
        get a fresh verification link. Password reset isn't self-serve yet —
        submit a bug report below and we'll sort it out.
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
