const displayLoadingCursor = (node) => {
  $("body").addClass("dcmax_waiting");
  if (node) $(node).addClass("dcmax_waiting");
};

const hideLoadingCursor = (node) => {
  $("body").removeClass("dcmax_waiting");
  if (node) $(node).removeClass("dcmax_waiting");
};
