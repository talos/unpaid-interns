all:
	mkdir -p ./css
	lessc ./less/bootstrap.less >./css/bootstrap.css
	lessc ./less/responsive.less >./css/bootstrap-responsive.css
