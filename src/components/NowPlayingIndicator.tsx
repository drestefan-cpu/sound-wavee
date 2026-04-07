const NowPlayingIndicator = ({ size = 12 }: { size?: number }) => (
  <div className="flex items-end gap-[2px]" style={{ height: size, width: size }}>
    <style>{`
      @keyframes now-bar-1 { 0%,100%{height:30%} 50%{height:100%} }
      @keyframes now-bar-2 { 0%,100%{height:60%} 50%{height:30%} }
      @keyframes now-bar-3 { 0%,100%{height:45%} 50%{height:90%} }
    `}</style>
    <div className="rounded-sm" style={{ width: "25%", height: "40%", backgroundColor: "#FF2D78", animation: "now-bar-1 0.8s ease-in-out infinite" }} />
    <div className="rounded-sm" style={{ width: "25%", height: "70%", backgroundColor: "#FF2D78", animation: "now-bar-2 0.8s ease-in-out infinite 0.2s" }} />
    <div className="rounded-sm" style={{ width: "25%", height: "50%", backgroundColor: "#FF2D78", animation: "now-bar-3 0.8s ease-in-out infinite 0.4s" }} />
  </div>
);

export default NowPlayingIndicator;
