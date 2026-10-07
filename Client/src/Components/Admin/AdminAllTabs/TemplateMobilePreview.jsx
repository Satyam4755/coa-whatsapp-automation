import PropTypes from "prop-types";

function TemplateMobilePreview({
  statusLabel,
  statusClassName,
  headerType,
  headerText,
  headerImageUrl,
  bodyText,
  footerText,
  buttons,
  variableCount,
  previewText,
  previewSubtitle = "Template preview",
  className = "",
}) {
  return (
    <div className={`w-full max-w-sm rounded-[2.5rem] border border-slate-300 bg-slate-950 p-3 shadow-sm ${className}`}>
      <div className="rounded-[2rem] bg-[#0b141a] p-2">
        <div className="overflow-hidden rounded-[1.75rem] bg-[#efeae2]">
          <div className="flex items-center justify-between rounded-t-[1.25rem] bg-[#075e54] px-4 py-3 text-white">
            <div className="min-w-0">
              <div className="text-sm font-medium">WhatsApp</div>
              <div className="text-[11px] text-white/80">{previewSubtitle}</div>
            </div>
            <div className="h-2.5 w-2.5 rounded-full bg-white/80" />
          </div>

          <div className="min-h-[540px] px-3 py-4">
            <div className="flex justify-end">
              <div className="max-w-[90%] overflow-hidden rounded-2xl rounded-br-md bg-white shadow-sm ring-1 ring-black/10">
                {headerType === "IMAGE" && headerImageUrl ? (
                  <img
                    src={headerImageUrl}
                    alt="Header preview"
                    className="max-h-64 w-full object-contain bg-white"
                  />
                ) : null}

                <div className="space-y-3 px-3 py-3">
                  {headerType === "TEXT" && headerText ? (
                    <div className="text-sm font-semibold leading-5 text-slate-900">
                      {headerText}
                    </div>
                  ) : null}

                  <div className="space-y-1 text-sm leading-6 text-slate-800">
                    {previewText || bodyText || "Your message preview will appear here."}
                  </div>

                  {footerText ? (
                    <div className="pt-1 text-xs leading-5 text-slate-500">
                      {footerText}
                    </div>
                  ) : null}

                  {buttons.length > 0 ? (
                    <div className="space-y-1 border-t border-slate-100 pt-2">
                      {buttons.map((button, index) => (
                        <div
                          key={index}
                          className="rounded-md bg-slate-50 px-3 py-2 text-center text-sm font-medium text-blue-600"
                        >
                          {button.text || "Button label"}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-slate-500">
                      {headerType === "IMAGE"
                        ? "Image header"
                        : headerType === "TEXT"
                          ? "Text header"
                          : "No header"}
                    </span>
                    <span className={`text-[11px] ${statusClassName || "text-slate-500"}`}>
                      {statusLabel || "Draft"}
                    </span>
                    <span className="text-[11px] text-slate-500">{variableCount} variables</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

TemplateMobilePreview.propTypes = {
  statusLabel: PropTypes.string,
  statusClassName: PropTypes.string,
  headerType: PropTypes.oneOf(["NONE", "TEXT", "IMAGE"]),
  headerText: PropTypes.string,
  headerImageUrl: PropTypes.string,
  bodyText: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  footerText: PropTypes.string,
  buttons: PropTypes.array,
  variableCount: PropTypes.number,
  previewText: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  previewSubtitle: PropTypes.string,
  className: PropTypes.string,
};

export default TemplateMobilePreview;
