/**
 * FlowOp — Anonymous Project Page
 *
 * Morphology-Agnostic Animation-to-Robot Motion Retargeting
 * via Sceneflow-Conditioned Diffusion
 *
 * Layout follows the MoCapAnythingV2 template:
 *   - Title-only hero (no Paper / GitHub buttons)
 *   - Anonymous authors / affiliations (under-review)
 *   - Sticky + side navigation
 *   - Abstract
 *   - Method (Overview.png + Architecture.png)
 *   - Deploy on Real Robot (video gallery, dance-anything style)
 *   - AnimBot Benchmark (video gallery, dance-anything style)
 *
 * Each VideoPlayer = top main player + bottom thumbnail strip;
 * thumbnails are clickable buttons; videos auto-advance when one ends.
 */

import {
  type FC,
  type ReactNode,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import "./App.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoClip {
  src: string;
  caption: string;
  // When provided, the player renders two videos side-by-side
  // (left = `src`, right = `srcRobot`) with synchronized playback.
  srcRobot?: string;
}

// ---------------------------------------------------------------------------
// Global active-player registry — only one video plays at a time
// ---------------------------------------------------------------------------

type PauseFn = () => void;
const activePlayers = new Set<PauseFn>();

function registerPlayer(pause: PauseFn): () => void {
  activePlayers.add(pause);
  return () => {
    activePlayers.delete(pause);
  };
}

function pauseAllExcept(pause: PauseFn) {
  activePlayers.forEach((fn) => {
    if (fn !== pause) fn();
  });
}

// ---------------------------------------------------------------------------
// VideoPlayer
//   - Top:    main video player (full width)
//   - Bottom: horizontal scrollable thumbnail strip
//             active thumb = scaled up + full opacity
//             inactive thumbs = scaled down + dimmed
// ---------------------------------------------------------------------------

interface VideoPlayerProps {
  clips: VideoClip[];
  title?: string;
}

const VideoPlayer: FC<VideoPlayerProps> = ({ clips, title }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRobotRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const thumbVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Whether *any* clip in this player carries a paired robot video. We render
  // the side-by-side layout for the whole gallery when so, to keep the main
  // player's geometry stable across clips.
  const hasPairedRobot = clips.some((c) => !!c.srcRobot);

  const pauseSelf = useCallback(() => {
    videoRef.current?.pause();
    videoRobotRef.current?.pause();
  }, []);

  // Only scroll thumbnails into view *after* the user clicks — avoids the page
  // jumping on first mount.
  const hasInteracted = useRef(false);

  useEffect(() => {
    return registerPlayer(pauseSelf);
  }, [pauseSelf]);

  // Wire thumbnail <video> srcs once on mount
  useEffect(() => {
    clips.forEach((clip, i) => {
      const el = thumbVideoRefs.current[i];
      if (el) {
        el.src = clip.src;
        el.load();
      }
    });
  }, [clips]);

  // When activeIdx changes: swap the main (and paired robot) srcs and play if visible
  useEffect(() => {
    const v = videoRef.current;
    const vR = videoRobotRef.current;
    if (!v) return;

    const clip = clips[activeIdx];
    v.src = clip.src;
    v.load();

    if (vR) {
      if (clip.srcRobot) {
        vR.src = clip.srcRobot;
        vR.load();
      } else {
        vR.removeAttribute("src");
        vR.load();
      }
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && rect.top < window.innerHeight && rect.bottom > 0) {
      pauseAllExcept(pauseSelf);
      v.play().catch(() => {});
      // The robot follows the master via the play-event listener below, but
      // we also nudge it here in case the listener attached too late.
      vR?.play().catch(() => {});
    }

    if (hasInteracted.current) {
      thumbnailRefs.current[activeIdx]?.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: "smooth",
      });
    }
  }, [activeIdx, clips, pauseSelf]);

  // Keep the paired robot video synchronized with the master (animation)
  // video — play / pause / seek all mirror across.
  useEffect(() => {
    const v = videoRef.current;
    const vR = videoRobotRef.current;
    if (!v || !vR) return;

    const onPlay = () => {
      vR.play().catch(() => {});
    };
    const onPause = () => {
      if (!vR.paused) vR.pause();
    };
    const onSeeked = () => {
      if (Number.isFinite(v.currentTime)) {
        vR.currentTime = v.currentTime;
      }
    };
    const onRateChange = () => {
      vR.playbackRate = v.playbackRate;
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("ratechange", onRateChange);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("ratechange", onRateChange);
    };
  }, []);

  // Pause when scrolled out of view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) pauseSelf();
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pauseSelf]);

  const handlePlay = () => pauseAllExcept(pauseSelf);

  // Auto-advance to the next clip when one finishes
  const handleEnded = () => {
    hasInteracted.current = true;
    setActiveIdx((i) => (i + 1) % clips.length);
  };

  const handleSelect = (idx: number) => {
    hasInteracted.current = true;
    if (idx === activeIdx) {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        pauseAllExcept(pauseSelf);
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    } else {
      setActiveIdx(idx);
    }
  };

  return (
    <div className="vp-wrapper" ref={containerRef}>
      {title && (
        <p className="subsection-title" style={{ marginBottom: 12 }}>
          {title}
        </p>
      )}

      {/* Main player */}
      <div className="vp-player-col">
        {hasPairedRobot ? (
          <div className="vp-pair-row">
            <div className="vp-pair-cell">
              <span className="vp-pair-label">Animation</span>
              <video
                ref={videoRef}
                className="vp-main-video pair"
                controls
                playsInline
                onPlay={handlePlay}
                onEnded={handleEnded}
              />
            </div>
            <div className="vp-pair-cell">
              <span className="vp-pair-label">Robot</span>
              <video
                ref={videoRobotRef}
                className="vp-main-video pair"
                muted
                playsInline
              />
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="vp-main-video"
            controls
            playsInline
            onPlay={handlePlay}
            onEnded={handleEnded}
          />
        )}
        <p className="vp-main-caption">{clips[activeIdx].caption}</p>
      </div>

      {/* Thumbnail strip */}
      <div className="vp-thumb-strip">
        {clips.map((clip, i) => {
          const isActive = i === activeIdx;
          return (
            <button
              key={i}
              ref={(el) => {
                thumbnailRefs.current[i] = el;
              }}
              className={`vp-thumb-btn${isActive ? " active" : ""}`}
              onClick={() => handleSelect(i)}
              title={clip.caption}
            >
              <video
                ref={(el) => {
                  thumbVideoRefs.current[i] = el;
                }}
                className="vp-thumb-video"
                preload="metadata"
                muted
                playsInline
              />
              <span className="vp-thumb-caption">{clip.caption}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const FriendlyDesc: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="friendly-desc">{children}</div>
);

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: "#abstract", label: "Abstract" },
  { href: "#method", label: "Method" },
  { href: "#deploy", label: "Real Robot" },
  { href: "#animbot", label: "AnimBot" },
  { href: "#inthewild", label: "In-the-Wild" },
];

const StickyNav: FC = () => (
  <nav className="sticky-nav has-text-centered">
    {NAV_LINKS.map((l) => (
      <a key={l.href} href={l.href}>
        {l.label}
      </a>
    ))}
  </nav>
);

const SideNav: FC = () => {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );

    NAV_LINKS.forEach((l) => {
      const el = document.getElementById(l.href.slice(1));
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="side-nav" aria-label="Section progress">
      {NAV_LINKS.map((l) => {
        const id = l.href.slice(1);
        const isActive = active === id;
        return (
          <a
            key={l.href}
            href={l.href}
            className={isActive ? "active" : ""}
          >
            <span className="dot" />
            <span className="label">{l.label}</span>
          </a>
        );
      })}
    </nav>
  );
};

// ---------------------------------------------------------------------------
// Hero — title only, no Paper / GitHub buttons
// ---------------------------------------------------------------------------

const HeroSection: FC = () => (
  <section className="hero">
    <div className="hero-body">
      <div className="container has-text-centered">
        <h1 className="title is-2">
          FlowOp: Morphology-Agnostic Animation-to-Robot Motion Retargeting
          via Sceneflow-Conditioned Diffusion
        </h1>
      </div>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// Authors — fully anonymous (this is a submission-time project page)
// ---------------------------------------------------------------------------

const AuthorsSection: FC = () => (
  <section className="section" style={{ paddingTop: "1rem" }}>
    <div className="container has-text-centered">
      <p className="publication-authors" style={{ fontSize: "1.1rem" }}>
        <span className="author-block">
          <em>Anonymous Authors</em>
        </span>
      </p>
      <p
        className="publication-authors"
        style={{ fontSize: "1rem", color: "#666", marginTop: "0.4rem" }}
      >
        <em>Anonymous Affiliation</em>
      </p>
      <p
        style={{
          fontSize: "0.9rem",
          color: "#888",
          marginTop: "0.6rem",
          fontStyle: "italic",
        }}
      >
        Paper under double-blind review. Author identities intentionally withheld.
      </p>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// Abstract — extracted from paper.pdf §Abstract
// ---------------------------------------------------------------------------

const AbstractSection: FC = () => (
  <section id="abstract" className="section">
    <div className="container">
      <h2 className="title is-3 has-text-centered">Abstract</h2>
      <div className="content has-text-justified">
        <p>
          Humanoid motion retargeting has advanced considerably, but existing
          pipelines are largely confined to mappings between humans and
          humanoid robots — asking a real robot to imitate the vivid
          choreography of an animated character remains effectively
          impossible. We formalize this gap as{" "}
          <strong>
            Morphology-Agnostic Animation-to-Robot Motion Retargeting
            (MA-A2R)
          </strong>
          : given an arbitrary animation video and the kinematic specification
          of a target humanoid, the goal is to produce a physically plausible
          joint-level trajectory that reproduces the source motion on the
          target robot. Unlike prior feature-matching retargeting methods, we
          leverage <em>sceneflow</em> to disentangle motion information across
          diverse animations and drive the target robot. Specifically, we
          propose <strong>FlowOp</strong>, which encodes sceneflow through a
          dual-branch visual-skeleton encoder, binds it to the target skeleton
          via geometry-driven proximity attention, and decodes joint
          trajectories with a rectified-flow Diffusion Transformer — producing
          physically plausible motion directly executable on the target robot.
          To support this task, we curate <strong>AnimBot</strong>, a
          benchmark of 7,800+ paired animation-to-robot motion clips with a
          manually audited cross-morphology split. Our method achieves an
          MPJPE of 0.77 on same-morphology videos and 5.62 on the
          cross-morphology stylized-character benchmark, demonstrating that
          decoupling motion content from source morphology provides a
          principled foundation for animation-to-robot transfer.
        </p>
      </div>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// Method — Overview.png (Sec. 3 / Fig. 1) + Architecture.png (Fig. 2)
// ---------------------------------------------------------------------------

const MethodSection: FC = () => (
  <section id="method" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">Method</h2>

      <h3
        id="overview"
        className="title is-4"
        style={{ marginTop: "2rem" }}
      >
        Overview
      </h3>
      <img
        style={{ width: "80%" }}
        src="figures/Overview.png"
        alt="FlowOp Overview"
      />
      <FriendlyDesc>
        <strong>Overview of FlowOp.</strong> Given an arbitrary animation
        character, FlowOp first reconstructs <em>sceneflow</em> from the input
        video and infers a morphology-agnostic 3D motion field. Conditioned
        on a reference humanoid robot, a rectified-flow Spatio-Temporal
        Diffusion Transformer predicts a physically plausible, deployable
        joint trajectory through an end-to-end framework — enabling the robot
        to imitate the animated character without any pre-defined
        source-to-target body correspondence.
      </FriendlyDesc>

      <h3
        id="framework"
        className="title is-4"
        style={{ marginTop: "3rem" }}
      >
        Framework
      </h3>
      <img
        style={{ width: "80%" }}
        src="figures/Architecture.png"
        alt="FlowOp Architecture"
      />
      <FriendlyDesc>
        <strong>FlowOp architecture.</strong> The{" "}
        <em>Visual Motion Branch</em> extracts motion features from the input
        video, point cloud, and source flow. The <em>Skeleton Branch</em>{" "}
        encodes the target robot's kinematic structure via topology-biased
        self-attention. <em>Geometry Binding</em> aligns the two branches
        through 3D-proximity-based joint-to-point attention with spatial
        positional encoding, converting source-point-indexed motion into
        target-joint-indexed conditions. The <em>Spatio-Temporal DiT</em>{" "}
        (12 blocks) then decodes joint trajectories under rectified-flow
        generation, conditioned on binding features, frame history, and the
        mean sceneflow direction injected via <em>Flow-Augmented AdaLN</em>.
        A training-only <em>Visual Dynamics Head (VDHead)</em> further
        regularizes the model by enforcing causal consistency between
        predicted motion and future visual states.
      </FriendlyDesc>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// Real-Robot Deployment Gallery — uses videos in /deploy_video
// ---------------------------------------------------------------------------

const DEPLOY_CLIPS: VideoClip[] = [
  { src: "deploy_video/0018_DanceTurns001.mp4", caption: "Dance Turns" },
  { src: "deploy_video/dance_chacha10.mp4", caption: "Cha-Cha #1" },
  { src: "deploy_video/dance_chacha15.mp4", caption: "Cha-Cha #2" },
  { src: "deploy_video/dance_jumpinplace.mp4", caption: "Jump in Place" },
  { src: "deploy_video/dance_stand.mp4", caption: "Standing Dance" },
  { src: "deploy_video/devishdance_stand.mp4", caption: "Dervish Dance" },
  { src: "deploy_video/twistdance_kick.mp4", caption: "Twist Kick" },
];

const DeploySection: FC = () => (
  <section id="deploy" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">1. Deployment on a Real Humanoid Robot</h2>
      <FriendlyDesc>
        FlowOp drives a real humanoid robot directly from monocular animation
        videos. The trajectories below are produced end-to-end from input
        videos and executed on the physical platform — no per-clip tuning or
        additional motion priors are used. Click any thumbnail to play; the
        next clip starts automatically when one finishes.
      </FriendlyDesc>
      <VideoPlayer clips={DEPLOY_CLIPS} />
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// AnimBot Benchmark Gallery — uses videos in /animbot_video
// ---------------------------------------------------------------------------

// Each AnimBot sample comes as a paired (animation, robot-render) mp4, with
// the latter suffixed `_stageii_rgb.mp4`.
const ab = (id: string, caption: string): VideoClip => ({
  src: `animbot_video/${id}.mp4`,
  srcRobot: `animbot_video/${id}_stageii_rgb.mp4`,
  caption,
});

const ANIMBOT_CLIPS: VideoClip[] = [
  // Newly replaced dataset-display clips first (Sample R · 01 moved after 141_19; 06_03 moved to end)
  ab("30_04", "Sample 30_04"),
  ab("35_31", "Sample 35_31"),
  ab("54_09", "Sample 54_09"),
  ab("106_27", "Sample 106_27"),
  ab("122_49", "Sample 122_49"),
  ab("139_10", "Sample 139_10"),
  ab("141_19", "Sample 141_19"),
  ab("01_R_2", "Sample R · 01"),
  // Remaining benchmark samples
  ab("0018_XinJiang003", "Xinjiang Dance"),
  ab("0015_BasicKendo001", "Basic Kendo"),
  ab("0005_Stomping001", "Stomping"),
  ab("07_11", "Sample 07_11"),
  ab("31_11", "Sample 31_11"),
  ab("32_07", "Sample 32_07"),
  ab("35_29", "Sample 35_29"),
  ab("49_01", "Sample 49_01"),
  ab("106_16", "Sample 106_16"),
  ab("106_18", "Sample 106_18"),
  ab("136_27", "Sample 136_27"),
  ab("138_23", "Sample 138_23"),
  ab("06_03", "Sample 06_03"),
];

const AnimBotSection: FC = () => (
  <section id="animbot" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">2. AnimBot Benchmark Gallery</h2>
      <FriendlyDesc>
        Results from <strong>AnimBot</strong>, our benchmark of 7,800+ paired
        animation-to-robot motion clips spanning humans, animals, and
        stylized characters. Each clip below was retargeted to the target
        humanoid using only its kinematic specification — no source skeleton,
        mesh, or body model is required at inference. Click any thumbnail to
        play; the next clip starts automatically.
      </FriendlyDesc>
      <VideoPlayer clips={ANIMBOT_CLIPS} />
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// In-the-Wild OOD Gallery — animations never seen during training
// ---------------------------------------------------------------------------

const itw = (id: string, caption: string): VideoClip => ({
  src: `inthewild_video/itw_${id}.mp4`,
  srcRobot: `inthewild_video/itw_${id}_robot.mp4`,
  caption,
});

const ITW_CLIPS: VideoClip[] = [
  itw("01", "SpongeBob SquarePants"),
  itw("02", "Mickey Mouse"),
  itw("03", "Ice Age (Sid)"),
  itw("04", "Crayon Shin-chan"),
  itw("05", "Shikanoko"),
  itw("06", "Gojo Satoru (Jujutsu Kaisen)"),
  itw("07", "Muramura Kohei"),
  itw("08", "Koga Tomoe (Bunny Girl Senpai)"),
  itw("09", "Totoro (Walking in Place)"),
];

const InTheWildSection: FC = () => (
  <section id="inthewild" className="section">
    <div className="container has-text-centered">
      <h2 className="title is-3">3. In-the-Wild OOD Generalization</h2>
      <FriendlyDesc>
        These clips are <strong>out-of-distribution (OOD)</strong> test cases:
        the source animations are <strong>never seen during training</strong>{" "}
        and are drawn from arbitrary in-the-wild cartoon, anime, and stylized
        footage. FlowOp generalizes to unseen morphologies and motion styles
        without any per-clip tuning — the robot trajectories below are produced
        end-to-end purely from the input video. Click any thumbnail to play;
        the next clip starts automatically.
      </FriendlyDesc>
      <VideoPlayer clips={ITW_CLIPS} />
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// Acknowledgement
// ---------------------------------------------------------------------------

const AcknowledgementSection: FC = () => (
  <section className="section">
    <div className="container has-text-centered">
      <h2 className="title is-4">Acknowledgement</h2>
      <p
        className="friendly-desc"
        style={{ textAlign: "center", width: "70%", marginTop: 15 }}
      >
        We referred to the project page of{" "}
        <a
          href="https://nerfies.github.io/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Nerfies
        </a>{" "}
        when creating this anonymous project page.
      </p>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <div className="wrapper" style={{ width: "80%" }}>
      <SideNav />
      <HeroSection />
      <AuthorsSection />
      <StickyNav />
      <AbstractSection />
      <MethodSection />
      <DeploySection />
      <AnimBotSection />
      <InTheWildSection />
      <AcknowledgementSection />
    </div>
  );
}
