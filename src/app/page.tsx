import Hero from "@/components/Hero";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import TechStack from "@/components/TechStack";
import Tokenomics from "@/components/Tokenomics";
import MarketSection from "@/components/MarketSection";
import WhyNow from "@/components/WhyNow";
import DemoWidget from "@/components/DemoWidget";
import SecuritySection from "@/components/SecuritySection";
import SocialProof from "@/components/SocialProof";
import Footer from "@/components/Footer";
import CTA from "@/components/CTA";

export default function Home() {
  return (
    <main className="flex flex-col w-full relative">
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <TechStack />
      <Tokenomics />
      <MarketSection />
      <WhyNow />
      <DemoWidget />
      <SecuritySection />
      <SocialProof />
      <CTA />
      <Footer />
    </main>
  );
}
