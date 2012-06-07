all:
	mkdir -p ./css
	lessc ./less/bootstrap.less >./css/bootstrap.css
