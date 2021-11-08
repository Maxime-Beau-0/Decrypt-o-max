const displayLoadingCursor = (node) => {
  $("body").addClass("ct_waiting");
  if (node) $(node).addClass("ct_waiting");
};

const hideLoadingCursor = (node) => {
  $("body").removeClass("ct_waiting");
  if (node) $(node).removeClass("ct_waiting");
};
