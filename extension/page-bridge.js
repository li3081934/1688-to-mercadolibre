(function () {
  const EVENT_NAME = "COLLECT_1688_STRUCTURED_DATA";

  function buildPayload() {
    const data = window.context?.result?.data || null;
    if (!data) {
      return null;
    }

    return {
      productTitle: data.productTitle?.fields || null,
      gallery: data.gallery?.fields || null,
      mainPrice: data.mainPrice?.fields || null,
      productPackInfo: data.productPackInfo?.fields || null,
      description: data.description?.fields || null
    };
  }

  window.addEventListener(EVENT_NAME, (event) => {
    window.postMessage(
      {
        source: EVENT_NAME,
        requestId: event.detail?.requestId,
        payload: buildPayload()
      },
      "*"
    );
  });
})();