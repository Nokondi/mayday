import { Link } from "react-router-dom";
import { Heart, Users, MapPin, HandHeart } from "lucide-react";
import { WaveDivider } from "../components/common/WaveDivider.js";
import { useAuth } from "../context/AuthContext.js";

export function AboutPage() {
  const { user } = useAuth();
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-mayday-500 to-mayday-700 text-white py-20">
        <WaveDivider />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Welcome to MayDay
          </h1>
          <p className="text-xl text-mayday-100">
            “Mutual aid projects let us practice meeting our own and each
            other’s needs, based in shared commitments to dignity, care, and
            justice.”
          </p>
          <p className="text-md text-mayday-100">
            ― Dean Spade,{" "}
            <i>
              Mutual Aid: Building Solidarity During This Crisis (And the Next)
            </i>
          </p>
        </div>
      </section>
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why MayDay?</h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-4">
            MayDay is both a call for help and a celebration of community. Ships
            in distress use the call, "mayday," to signal that they need
            immediate assistance. May Day is also an ancient spring festival ― a
            celebration of life and renewal ― and it is the date of
            International Workers' Day, a day of solidarity and mutual aid. We
            chose the name MayDay to reflect our mission of connecting people in
            need with those who can help, while also honoring the spirit of
            community and solidarity that has been practiced and celebrated for
            centuries.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            How It Works
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-mayday-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Heart className="w-6 h-6 text-mayday-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Post a Request</h3>
                <p className="text-gray-600">
                  Share what you need with the community. Requests can range
                  from everyday essentials to emotional support.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <HandHeart className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Offer Resources</h3>
                <p className="text-gray-600">
                  Let your neighbors know what you can provide — skills, time,
                  supplies, or just a listening ear.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Find Nearby Help</h3>
                <p className="text-gray-600">
                  Use the map to discover requests and offers near you, making
                  it easy to connect locally.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Join Communities</h3>
                <p className="text-gray-600">
                  Organize with your neighbors through communities and
                  organizations to build lasting support networks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      {!user && (
        <section className="py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to get involved?
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Join MayDay today and start making a difference in your community.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                to="/register"
                className="bg-mayday-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-mayday-700"
              >
                Sign up
              </Link>
              <Link
                to="/login"
                className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50"
              >
                Log in
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
