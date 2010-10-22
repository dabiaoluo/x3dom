/*!
* x3dom javascript library 0.1
* http://x3dom.org/
*
* Copyright (c) 2009 Peter Eschler, Johannes Behr, Yvonne Jung
*     based on code originally provided by Philip Taylor:
*     http://philip.html5.org
* Dual licensed under the MIT and GPL licenses.
* 
*/


x3dom.gfx_webgl = (function () {

	function Context(ctx3d, canvas, name) {
		this.ctx3d = ctx3d;
		this.canvas = canvas;
		this.name = name;
		this.cached_shader_programs = {};
		this.cached_shaders = {};	
	}

	Context.prototype.getName = function() {
		return this.name;
	};

	function setupContext(canvas) {
		// TODO: add experimental-webgl, webgl test    
		// x3dom.debug.logInfo("setupContext: canvas=" + canvas);
        var validContextNames = ['moz-webgl', 'webkit-3d', 'experimental-webgl', 'webgl'];
        var ctx = null;
        // Context creation params (not yet working)
        // https://cvs.khronos.org/svn/repos/registry/trunk/public/webgl/doc/spec/WebGL-spec.html#5.2.1
        var ctxAttribs = { alpha: true,
                           depth: true,
                           stencil: true,
                           antialias: true,
                           premultipliedAlpha: false 
                         };
        // FIXME; do we need to handle context lost events?
        // https://cvs.khronos.org/svn/repos/registry/trunk/public/webgl/doc/spec/WebGL-spec.html#5.16.1
        for (var i=0; i<validContextNames.length; i++) {
            try {
                ctx = canvas.getContext(validContextNames[i], ctxAttribs);
                if (ctx) {
                    var newCtx = new Context(ctx, canvas, 'webgl');
                    
                    /*
                    var ext = "";
                    for (var fName in ctx) {
                        ext += (fName + " / ");
                    }
                    x3dom.debug.logInfo(ext);
                    */
                    if (ctx.getString) {
                        x3dom.debug.logInfo("\nVendor: " + ctx.getString(ctx.VENDOR) + ", " + 
                                            "Renderer: " + ctx.getString(ctx.RENDERER) + ", " + 
                                            "Version: " + ctx.getString(ctx.VERSION) + ", " + 
                                            "ShadingLangV.: " + ctx.getString(ctx.SHADING_LANGUAGE_VERSION) + ", " + 
                                            "\nExtensions: " + ctx.getString(ctx.EXTENSIONS));
                    }
                    else {
                        x3dom.debug.logInfo("\nVendor: " + ctx.getParameter(ctx.VENDOR) + ", " + 
                                            "Renderer: " + ctx.getParameter(ctx.RENDERER) + ", " + 
                                            "Version: " + ctx.getParameter(ctx.VERSION) + ", " + 
                                            "ShadingLangV.: " + ctx.getParameter(ctx.SHADING_LANGUAGE_VERSION) + ", " + 
                                            "\nExtensions: " + ctx.getParameter(ctx.EXTENSIONS));
                    }
                    //x3dom.debug.logInfo(ctx.getSupportedExtensions());
                    
                    return newCtx;
                }
            }
            catch (e) {}
        }
		return null;
	}

	var g_shaders = {};
    
    g_shaders['vs-x3d-bg-texture'] = { type: "vertex", data:
		"attribute vec3 position;" +
		"varying vec2 fragTexCoord;" +
		"" +
		"void main(void) {" +
		"    gl_Position = vec4(position.xy, 0.0, 1.0);" +
        "    vec2 texCoord = (position.xy + 1.0) * 0.5;" +
        "    fragTexCoord = texCoord;" +
		"}"
		};
        
    g_shaders['fs-x3d-bg-texture'] = { type: "fragment", data:
        "#ifdef GL_ES             \n" +
        "  precision highp float; \n" +
        "#endif                   \n" +
        "\n" +
		"uniform sampler2D tex;" +
		"varying vec2 fragTexCoord;" +
		"" +
		"void main(void) {" +
		"    gl_FragColor = texture2D(tex, fragTexCoord);" +
		"}"
		};
        
    g_shaders['vs-x3d-bg-textureCube'] = { type: "vertex", data:
		"attribute vec3 position;" +
		"uniform mat4 modelViewProjectionMatrix;" +
        "varying vec3 fragNormal;" +
		"" +
		"void main(void) {" +
        "    fragNormal = (vec4(normalize(position), 0.0)).xyz;" +
		"    gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);" +
		"}"
		};
        
    g_shaders['fs-x3d-bg-textureCube'] = { type: "fragment", data:
        "#ifdef GL_ES             \n" +
        "  precision highp float; \n" +
        "#endif                   \n" +
        "\n" +
        "uniform samplerCube tex;" +
        "varying vec3 fragNormal;" +
		"" +
		"void main(void) {" +
        "    vec3 normal = -reflect(normalize(fragNormal), vec3(0.0,0.0,1.0));" +
        "    if (abs(normal.y) >= abs(normal.x) && abs(normal.y) >= abs(normal.z))" +
        "        normal.x *= -1.0;" +
        "    gl_FragColor = textureCube(tex, normal);" +
		"}"
		};
	
    g_shaders['vs-x3d-vertexcolorUnlit'] = { type: "vertex", data:
        "attribute vec3 position;" +
        "attribute vec3 color;" +
        "varying vec3 fragColor;" +
        "uniform mat4 modelViewProjectionMatrix;" +
        "" +
        "void main(void) {" +
        "    gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);" +
        "    fragColor = color;" +
        "}"
        };
    
    g_shaders['fs-x3d-vertexcolorUnlit'] = { type: "fragment", data:
        "#ifdef GL_ES             \n" +
        "  precision highp float; \n" +
        "#endif                   \n" +
        "\n" +
        "uniform vec3 diffuseColor;" +
        "uniform float alpha;" +
        "uniform float lightOn;" +
        "varying vec3 fragColor;" +
        "" +
        "void main(void) {" +
        "    gl_FragColor = vec4(fragColor, alpha);" +
        "}"
        };

	g_shaders['vs-x3d-default'] = { type: "vertex", data:
		"attribute vec3 position;" +
		"uniform mat4 modelViewProjectionMatrix;" +
		"void main(void) {" +
		"    gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);" +
		"}"
		};

	g_shaders['fs-x3d-default'] = { type: "fragment", data:
        "#ifdef GL_ES             \n" +
        "  precision highp float; \n" +
        "#endif                   \n" +
        "\n" +
		"struct Material {" +
		"	vec3  diffuseColor;" +
		"	vec3  specularColor;" +
		"	vec3  emissiveColor;" +
		"	float shininess;" +
		"	float transparency;" +
		"	float ambientIntensity;" +
		"};" +
		"uniform Material material;" +
		"void main(void) {" +
		"    gl_FragColor = vec4(material.emissiveColor, 1.0);" +
		"}"
		};
        
    // TEST SHADER FOR PICKING TEXTURE COORDINATES INSTEAD OF COLORS
    g_shaders['vs-x3d-texcoordUnlit'] = { type: "vertex", data:
        "attribute vec3 position;" +
        "attribute vec2 texcoord;" +
        "varying vec3 fragColor;" +
        "uniform mat4 modelViewProjectionMatrix;" +
        "" +
        "void main(void) {" +
        "    gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);" +
        "    fragColor = vec3(abs(texcoord.x), abs(texcoord.y), 0.0);" +
        "}"
        };
    
    g_shaders['fs-x3d-texcoordUnlit'] = { type: "fragment", data:
        "#ifdef GL_ES             \n" +
        "  precision highp float; \n" +
        "#endif                   \n" +
        "\n" +
        "uniform float alpha;" +
        "varying vec3 fragColor;" +
        "" +
        "void main(void) {" +
        "    gl_FragColor = vec4(fragColor, alpha);" +
        "}"
        };
    
    g_shaders['vs-x3d-pick'] = { type: "vertex", data:
		"attribute vec3 position;" +
        "uniform mat4 modelMatrix;" +
		"uniform mat4 modelViewProjectionMatrix;" +
        "uniform vec3 wcMin;" +
        "uniform vec3 wcMax;" +
        "varying vec3 worldCoord;" +
		"void main(void) {" +
        "    worldCoord = (modelMatrix * vec4(position, 1.0)).xyz;" +
        "    vec3 dia = wcMax - wcMin;" +
        "    worldCoord = worldCoord - wcMin;" +
        "    worldCoord.x /= dia.x;" +
        "    worldCoord.y /= dia.y;" +
        "    worldCoord.z /= dia.z;" +
		"    gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);" +
		"}"
		};

	g_shaders['fs-x3d-pick'] = { type: "fragment", data:
        "#ifdef GL_ES             \n" +
        "  precision highp float; \n" +
        "#endif                   \n" +
        "\n" +
		"uniform float alpha;" +
        "varying vec3 worldCoord;" +
		"void main(void) {" +
		"    gl_FragColor = vec4(worldCoord, alpha);" +
		"}"
		};

	g_shaders['vs-x3d-shadow'] = { type: "vertex", data:
		"attribute vec3 position;" +
		"uniform mat4 modelViewProjectionMatrix;" +
        "varying vec4 projCoord;" +
		"void main(void) {" +
        "   projCoord = modelViewProjectionMatrix * vec4(position, 1.0);" +
		"   gl_Position = projCoord;" +
		"}"
		};

	g_shaders['fs-x3d-shadow'] = { type: "fragment", data:
        "#ifdef GL_ES             \n" +
        "  precision highp float; \n" +
        "#endif                   \n" +
        "\n" +
        "varying vec4 projCoord;" +
		"void main(void) {" +
        "    vec3 proj = (projCoord.xyz / projCoord.w);" +
		"    float dist = proj.z * 4294967296.0;" +
        "    float alpha = float(int(dist / 16777216.0));" +
		"    dist = dist - float(int(alpha)) * 16777216.0;" +
		"    float red = float(int(dist / 65536.0));" +
		"    dist = dist - float(int(red)) * 65536.0;" +
		"    float green = float(int(dist / 256.0));" +
        "    dist = dist - float(int(green)) * 256.0;" +
		"    float blue = float(int(dist / 256.0));" +
		"    gl_FragColor = vec4(red/256.0, green/256.0, blue/256.0, alpha/256.0);" +
		"}"
		};
		
	function getDefaultShaderProgram(gl, suffix) 
	{
		var prog = gl.createProgram();
		var vs = gl.createShader(gl.VERTEX_SHADER);
		var fs = gl.createShader(gl.FRAGMENT_SHADER);
		
		gl.shaderSource(vs, g_shaders['vs-x3d-'+suffix].data);
		gl.shaderSource(fs, g_shaders['fs-x3d-'+suffix].data);
		gl.compileShader(vs);
		gl.compileShader(fs);
		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);
		gl.linkProgram(prog);
		
		var msg = gl.getProgramInfoLog(prog);
		if (msg) {
			x3dom.debug.logError(msg);
        }
		
		return wrapShaderProgram(gl, prog);
	}
	
	function scaleImage(image)
	{
		if (!isPowerOfTwo(image.width) || !isPowerOfTwo(image.height)) {
			var canvas = document.createElement("canvas");
			canvas.width = nextHighestPowerOfTwo(image.height);
			canvas.height = nextHighestPowerOfTwo(image.height);
			var ctx = canvas.getContext("2d");
			ctx.drawImage(image,
						  0, 0, image.width, image.height,
                          0, 0, canvas.width, canvas.height);
			image = canvas;
		}
		return image
	}
	
	function isPowerOfTwo(x) 
	{
		return ((x & (x - 1)) === 0);
	}
	
	function nextHighestPowerOfTwo(x) 
	{
		--x;
		for (var i = 1; i < 32; i <<= 1) {
			x = x | x >> i;
		}
		return (x + 1);
	}
	
	function nextBestPowerOfTwo(x)
	{
		var log2x = Math.log(x) / Math.log(2)
		return Math.pow(2, Math.round(log2x));
	}

	
	Context.prototype.getShaderProgram = function(gl, ids) 
	{
		var shader = [];
        var prog = null;
		
		if( this.cached_shader_programs[ids[0]+ids[1]] ) {
			prog = this.cached_shader_programs[ids[0]+ids[1]];
			//x3dom.debug.logInfo("Using cached shader program");
		} 
		else 
		{
			for (var id = 0; id < 2; id++) 
			{
          		if (!g_shaders[ids[id]]) {
		            x3dom.debug.logError('Cannot find shader ' + ids[id]);
					return;
            	}
				// Try to cache shaders because this might be expensive...
				if( this.cached_shaders[ids[id]] ) {
					shader[id] = this.cached_shaders[ids[id]];
					//x3dom.debug.logInfo("Using cached shader");
				} else {
		            if (g_shaders[ids[id]].type == 'vertex') {
		                shader[id] = gl.createShader(gl.VERTEX_SHADER);
					}
					else if (g_shaders[ids[id]].type == 'fragment') {
						shader[id] = gl.createShader(gl.FRAGMENT_SHADER);
					}
					else {
						x3dom.debug.logError('Invalid shader type ' + g_shaders[id].type);
						return;
					}
					gl.shaderSource(shader[id], g_shaders[ids[id]].data);
					gl.compileShader(shader[id]);
					this.cached_shaders[ids[id]] = shader[id];
            	}
        	}
        	
		    prog = gl.createProgram();
        	gl.attachShader(prog, shader[0]);
        	gl.attachShader(prog, shader[1]);
        	gl.linkProgram(prog);
        	var msg = gl.getProgramInfoLog(prog);
        		
			if (msg) {
		        x3dom.debug.logError(msg);
			}
            this.cached_shader_programs[ids[0]+ids[1]] = wrapShaderProgram(gl, prog);
    		prog = this.cached_shader_programs[ids[0]+ids[1]];
		}
		
        return prog;
	}
	
	// Returns "shader" such that "shader.foo = [1,2,3]" magically sets the appropriate uniform
	function wrapShaderProgram(gl, sp) 
	{
		var shader = {};
		
		shader.bind = function () { 
            gl.useProgram(sp); 
        };
		
        var loc = null, obj = null;
		var i = 0;
        var glErr;
        
        var numUniforms = gl.getProgramParameter(sp, gl.ACTIVE_UNIFORMS);
		
		for (i=0; i < numUniforms; ++i) {
			try {
				obj = gl.getActiveUniform(sp, i);
				//x3dom.debug.logInfo("uniform #" + i + " obj=" + obj.name );
			}
			catch (eu) {}

            glErr = gl.getError();
            
			if (glErr !== 0) {
				//x3dom.debug.logInfo("GetProgramiv(ACTIVE_UNIFORMS) not implemented, loop until error");
                x3dom.debug.logInfo("GL-Error: " + glErr);
				//break;
			}

			loc = gl.getUniformLocation(sp, obj.name);
			
			switch (obj.type) {
				case gl.SAMPLER_2D:
					shader.__defineSetter__(obj.name, 
						(function (loc) { return function (val) { gl.uniform1i(loc, val); }; })(loc));
					break;
				case gl.SAMPLER_CUBE:
					shader.__defineSetter__(obj.name, 
						(function (loc) { return function (val) { gl.uniform1i(loc, val); }; })(loc));
					break;
				case gl.BOOL:
					shader.__defineSetter__(obj.name, 
						(function (loc) { return function (val) { gl.uniform1i(loc, val); }; })(loc));
					break;
				case gl.FLOAT:
					shader.__defineSetter__(obj.name, 
						(function (loc) { return function (val) { gl.uniform1f(loc, val); }; })(loc));
					break;
				case gl.FLOAT_VEC2:
					shader.__defineSetter__(obj.name, 
						(function (loc) { return function (val) { gl.uniform2f(loc, val[0], val[1]); }; })(loc));           
					break;
				case gl.FLOAT_VEC3:
					shader.__defineSetter__(obj.name, 
						(function (loc) { return function (val) { gl.uniform3f(loc, val[0], val[1], val[2]); }; })(loc));
					break;
				case gl.FLOAT_VEC4:
					shader.__defineSetter__(obj.name, 
						(function (loc) { return function (val) { gl.uniform4f(loc, val[0], val[1], val[2], val[3]); }; })(loc));
					break;
				case gl.FLOAT_MAT2:
					shader.__defineSetter__(obj.name, 
						(function (loc) { return function (val) { gl.uniformMatrix2fv(loc, false, new Float32Array(val)); }; })(loc));
					break;
				case gl.FLOAT_MAT3:
					shader.__defineSetter__(obj.name, 
						(function (loc) { return function (val) { gl.uniformMatrix3fv(loc, false, new Float32Array(val)); }; })(loc));
					break;
				case gl.FLOAT_MAT4:
					shader.__defineSetter__(obj.name, 
						(function (loc) { return function (val) { gl.uniformMatrix4fv(loc, false, new Float32Array(val)); }; })(loc));
					break;
				case gl.INT:
					shader.__defineSetter__(obj.name,
						(function (loc) { return function (val) { gl.uniform1i(loc, val); }; }) (loc));
					break;
				default:
					x3dom.debug.logInfo('GLSL program variable '+obj.name+' has unknown type '+obj.type);
			}
		}
		
        var numAttribs = gl.getProgramParameter(sp, gl.ACTIVE_ATTRIBUTES);
        
		for (i=0; i < numAttribs; ++i) {
			try {
				obj = gl.getActiveAttrib(sp, i);
				//x3dom.debug.logInfo("attribute #" + i + " obj=" + obj.name );
			}
			catch (ea) {}
			
            glErr = gl.getError();
            
			if (glErr !== 0) {
				//x3dom.debug.logInfo("GetProgramiv(ACTIVE_ATTRIBUTES) not implemented, loop until error");
                x3dom.debug.logInfo("GL-Error: " + glErr);
				//break;	
			}

			loc = gl.getAttribLocation(sp, obj.name);
			shader[obj.name] = loc;
		}
		
		return shader;
	}
	
	//Checks for lighting and shadowing
	//return 0 if no Lights, 1 if Lights, 2 if Lights + Shadows
	function useLightingFunc(viewarea)
	{
		var result = [0, false];
		var slights = viewarea.getLights();	
		var numLights = slights.length;
		if(numLights > 0){
			if(numLights > 8){
				result[0] = 8;
			}else{
				result[0] = numLights;
			}
		}
		
		//Check for Shadows
		for(var i=0; i<numLights; i++){
			if(slights[i]._vf.shadowIntensity > 0.0){
				result[1] = true;
			}
		}
				
		var nav = viewarea._scene.getNavigationInfo();
		if(nav._vf.headlight) result[0] += 1;
			
		return result
	}
	
	function useFogFunc(viewarea)
	{
		var fog = viewarea._scene.getFog();
		if(fog._vf.visibilityRange > 0)
			return 1;
		else
			return 0;
	}
	
	Context.prototype.generateVS = function (viewarea, vertexColor, texture, textureTransform, useLighting)
	{
	
		var useFog = useFogFunc(viewarea);
		var shaderIdentifier = "vs-x3d-" + ( (vertexColor) ? 1 : 0 ) + 
										   ( (texture) ? 1 : 0 ) +
										   ( (textureTransform) ? 1 : 0 ) +
										   ( (useFog) ? 1 : 0 ) +
										   ( useLighting[0] ) +
										   ( (useLighting[1]) ? 1 : 0 );
		
		if(!g_shaders[shaderIdentifier]){
			//x3dom.debug.logInfo("generate new Vertex Shader: " + shaderIdentifier);
			
			var shader = "";
			
			//Set Attributes +Uniforms + Varyings
			shader += "attribute vec3 position;";
			shader += "attribute vec3 normal;";
			shader += "uniform mat4 modelViewMatrix;";
			shader += "uniform mat4 modelViewProjectionMatrix;";
			shader += "varying vec3 fragNormal;";

			if(vertexColor){
				if(vertexColor == 3){
					shader += "attribute vec3 color;";
					shader += "varying vec3 fragColor;";
				}else{
					shader += "attribute vec4 color;";
					shader += "varying vec4 fragColor;";
				}
			}
			if(texture){
				shader += "attribute vec2 texcoord;";
				shader += "varying vec2 fragTexcoord;";
				shader += "uniform float sphereMapping;";
				if(textureTransform){
					shader += "uniform mat4 texTrafoMatrix;";
				}
			}
			
			if(useLighting[0] >= 1 || useFog){
				//shader += "uniform mat4 normalMatrix;";
				
				shader += "uniform vec3 eyePosition;";
				shader += "varying vec3 fragEyePosition;";
				shader += "varying vec3 fragPosition;";
				
				if(useLighting[1]){
					shader += "uniform mat4 matPV;";
					shader += "varying vec4 projCoord;";
				}
			}
			
			//Set Main
			shader += "void main(void) {";	
			if(vertexColor){
				shader += "fragColor = color;";
			}
			
			shader += "fragNormal = (modelViewMatrix * vec4(normal, 0.0)).xyz;";
			//shader += "fragNormal = (normalMatrix * vec4(normal, 1.0)).xyz;";
			
			if(useLighting[0] >= 1 || useFog){	
				shader += "fragPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;";
				shader += "fragEyePosition = eyePosition - fragPosition;";
				if(useLighting[1]){
					shader += "projCoord = matPV * vec4(position+0.5*normalize(normal), 1.0);";
				}
			}
			if(texture){
				shader += "if (sphereMapping == 1.0) {";
				shader += "	fragTexcoord = 0.5 + fragNormal.xy / 2.0;";
				shader += "}else{";
				if(textureTransform){
					shader += "	fragTexcoord = (texTrafoMatrix * vec4(texcoord, 1.0, 1.0)).xy;";
				}else{
					shader += "	fragTexcoord = texcoord;";
				}
				shader += "}";
			
			}
			shader += "gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);";
			shader += "}";
			
			g_shaders[shaderIdentifier] = {};
			g_shaders[shaderIdentifier].type = "vertex";
			g_shaders[shaderIdentifier].data = shader;
		}else{
			//x3dom.debug.logInfo("using existend Vertex Shader: " + shaderIdentifier);
		}
		
		return shaderIdentifier;
	}
	
	Context.prototype.generateFS = function (viewarea, vertexColor, texture, useLighting)
	{
		var useFog = useFogFunc(viewarea);
		var shaderIdentifier = "fs-x3d-" + ( (vertexColor) ? 1 : 0 ) + 
										   ( (texture) ? 1 : 0 ) +
										   ( (useFog) ? 1 : 0 ) +
										   ( useLighting[0] ) +
										   ( (useLighting[1]) ? 1 : 0 );
		
		if(!g_shaders[shaderIdentifier]){
			//x3dom.debug.logInfo("generate new FragmentShader: " + shaderIdentifier);
			
			var fog = 	"struct Fog {" +
						"	vec3  color;" +
						"	float fogType;" +
						"	float visibilityRange;" +
						"};" +
						"uniform Fog fog;" +
						"float calcFog() {" +
						"	float f0 = 0.0;" +		
						"	if(fog.fogType == 0.0) {" +
						"		if(length(fragEyePosition) < fog.visibilityRange){" +
						"			f0 = (fog.visibilityRange-length(fragEyePosition)) / fog.visibilityRange;" +
						"		}" +
						"	}else{" +
						"		if(length(fragEyePosition) < fog.visibilityRange){" +
						"			f0 = exp(-length(fragEyePosition) / (fog.visibilityRange-length(fragEyePosition) ) );" +
						"		}" +
						"	}" +
						"	f0 = clamp(f0, 0.0, 1.0);" +
						"	return f0;" +
						"}";
						
			var light = "struct Light {" +
						"   float on;" +
						"	float type;" +
						"	vec3  location;" +
						"	vec3  direction;" +
						"	vec3  color;" +
						"	vec3  attenuation;" +
						"	float intensity;" +
						"	float ambientIntensity;" +
						"	float beamWidth;" +
						"	float cutOffAngle;" +
						"	float shadowIntensity;" +
						"};" +
						"const int NUMLIGHTS = " + useLighting[0] + ";" +
						"uniform Light light[NUMLIGHTS];" +
						"void lighting(in Light light, in vec3 normal, in vec3 eye, inout vec3 ambient, inout vec3 diffuse, inout vec3 specular){" +
						"	vec3 lightDirection;" +
						"	float spot = 1.0, attentuation = 1.0;" +
						"	if(light.type == 0.0) {" +
						"		lightDirection = normalize(-light.direction);" +
						"	}else{" +
						"		float distance = length(light.location - fragPosition.xyz);" +
						"		attentuation = 1.0 / max(light.attenuation.x + light.attenuation.y * distance + light.attenuation.z * pow(distance,2.0), 1.0);" +
						"		lightDirection = normalize(light.location - fragPosition.xyz);" +
						"		if(light.type == 2.0) {" +
						"			float spotAngle = acos(max(0.0, dot(-lightDirection, normalize(light.direction))));" +
						"			if(spotAngle >= light.cutOffAngle) spot = 0.0;" +
						"			else if(spotAngle <= light.beamWidth) spot = 1.0;" +
						"			else spot = (spotAngle - light.cutOffAngle ) / (light.beamWidth - light.cutOffAngle);" +
						"		}" +
						"	}" +
						"	float ambientFactor  = light.ambientIntensity * material.ambientIntensity;" +
						"	float diffuseFactor  = light.intensity * max(0.0, dot(normal, lightDirection));" +
						"   float specularFactor = light.intensity * abs(pow(max(0.0, dot(normal, normalize(lightDirection+eye))), material.shininess*128.0));" +
						"	ambient += light.color * ambientFactor * attentuation * spot;" +
						"	diffuse += light.color * diffuseFactor * attentuation * spot;" +
						"	specular += light.color * specularFactor * attentuation * spot;" +	
						"}";
						
			var shadow = 	"uniform sampler2D sh_tex;" +
							"varying vec4 projCoord;" +
							"float PCF_Filter(Light light, vec3 projectiveBiased, float filterWidth)" +
							"{" +
							"    float stepSize = 2.0 * filterWidth / 3.0;" +
							"    float blockerCount = 0.0;" +
							"    projectiveBiased.x -= filterWidth;" +
							"    projectiveBiased.y -= filterWidth;" +
							"    for (float i=0.0; i<3.0; i++)" +
							"    {" +
							"        for (float j=0.0; j<3.0; j++)" +
							"        {" +
							"            projectiveBiased.x += (j*stepSize);" +
							"            projectiveBiased.y += (i*stepSize);" +
							"            vec4 shCol = texture2D(sh_tex, (1.0+projectiveBiased.xy)*0.5);" +
							"            float z = (shCol.a * 16777216.0 + shCol.r * 65536.0 + shCol.g * 256.0 + shCol.b) / 16777216.0;" +
							"            if (z < projectiveBiased.z) blockerCount += 1.0;" +
							"            projectiveBiased.x -= (j*stepSize);" +
							"            projectiveBiased.y -= (i*stepSize);" +
							"        }" +
							"    }" +
							"    float result = 1.0 - light.shadowIntensity * blockerCount / 9.0;" +
							"    return result;" +
							"}";
			
			var material =	"struct Material {" +
							"	vec3  diffuseColor;" +
							"	vec3  specularColor;" +
							"	vec3  emissiveColor;" +
							"	float shininess;" +
							"	float transparency;" +
							"	float ambientIntensity;" +
							"};" +
							"uniform Material material;";
					
			var shader = "";
			shader += "#ifdef GL_ES             \n";
			shader += "  precision highp float; \n";
			shader += "#endif                   \n";
			shader += "\n";
			
			//Set Uniforms + Varyings
			shader += material;
			if(vertexColor){
				if(vertexColor == 3){
					shader += "varying vec3 fragColor;";
				}else{
					shader += "varying vec4 fragColor;";
				}
			}
			if(texture){
				shader += "uniform sampler2D tex;";
				shader += "uniform float sphereMapping;";
				shader += "varying vec2 fragTexcoord;";
				shader += "uniform float useText;";
			}
			
			if(useLighting[0] >= 1){
				shader += "uniform float solid;";
				shader += "varying vec3 fragNormal;";
				shader += "varying vec3 fragPosition;";
				shader += "varying vec3 fragEyePosition;";
				shader += light;
				if(useLighting[1])
					shader += shadow;
			}
			if(useFog){
				shader += fog;
				if(!useLighting[0]){
					shader += "varying vec3 fragEyePosition;";
				}
			}
			
			//Set Main
			shader += "void main(void) {";
				
			shader += "vec3 rgb 	 = vec3(0.0);";
			shader += "float alpha = 1.0 - material.transparency;";
			
			if(useLighting[0] >= 1){
				shader += "vec3 ambient   = vec3(0.0);";
				shader += "vec3 diffuse   = vec3(0.0);";
				shader += "vec3 specular  = vec3(0.0);";
				if(useLighting[1]){
					shader += "float shadowed = 1.0;";
					shader += "float oneShadowAlreadyExists = 0.0;";
				}
				shader += "vec3 eye = normalize(fragEyePosition);";
				shader += "vec3 normal = normalize(fragNormal);";
				shader += "if (solid == 0.0 && dot(normal, eye) < 0.0) {";
				shader += "	normal *= -1.0;";
				shader += "}";
				shader += "for(int i=0; i<NUMLIGHTS; i++) {";
				shader += "	lighting(light[i], normal, eye, ambient, diffuse, specular);";
				if(useLighting[1]){
					shader += "	if(light[i].shadowIntensity > 0.0 && oneShadowAlreadyExists == 0.0){";
					shader += "		vec3 projectiveBiased = projCoord.xyz / projCoord.w;";
					shader += "		shadowed = PCF_Filter(light[i], projectiveBiased, 0.002);";
					shader += "		oneShadowAlreadyExists = 1.0;";
					shader += "	}";
				}
				shader += "}";
				if(texture){
					shader += "vec2 texCoord = vec2(fragTexcoord.x, 1.0-fragTexcoord.y);";
					shader += "vec4 texColor = texture2D(tex, texCoord);";
					shader += "alpha *= texColor.a;";
					shader += "if(sphereMapping == 1.0 || useText == 1.0){";
					shader += "rgb = (material.emissiveColor + ambient*material.diffuseColor + diffuse*material.diffuseColor + specular*material.specularColor)*texColor.rgb;";
					shader += "}else{";
					shader += "rgb = (material.emissiveColor + ambient*texColor.rgb + diffuse*texColor.rgb + specular*material.specularColor);";
					shader += "}";
				}else if(vertexColor){
					shader += "rgb = diffuse*fragColor.rgb;";
					if(vertexColor == 4)
						shader += "alpha = fragColor.a;";
				}else{
					shader += "rgb = (material.emissiveColor + ambient*material.diffuseColor + diffuse*material.diffuseColor + specular*material.specularColor);";
				}
				if(useLighting[1])
					shader += "rgb *= shadowed;";
				
			}else{
				if(texture){
					shader += "vec2 texCoord = vec2(fragTexcoord.x, 1.0-fragTexcoord.y);";
					shader += "vec4 texColor = texture2D(tex, texCoord);";
					shader += "rgb = texColor.rgb;";
					shader += "alpha *= texColor.a;";
				}else if(vertexColor){
					shader += "rgb = fragColor.rgb;";
					if(vertexColor == 4)
						shader += "alpha = fragColor.a;";
				}else{
					shader += "rgb = material.diffuseColor + material.emissiveColor;";
				}
			}
			if(useFog){
				shader += "float f0 = calcFog();";
				shader += "rgb = fog.color * (1.0-f0) + f0 * (rgb);";
			}
			shader += "rgb = clamp(rgb, 0.0, 1.0);";
			shader += "if (alpha <= 0.1) discard;";
			shader += "else gl_FragColor = vec4(rgb, alpha);";
			shader += "}";
			
			g_shaders[shaderIdentifier] = {};
			g_shaders[shaderIdentifier].type = "fragment";
			g_shaders[shaderIdentifier].data = shader;
		}else{
			//x3dom.debug.logInfo("using existing Fragment Shader: " + shaderIdentifier);
		}
		
		return shaderIdentifier;
	}
    
    /** setup gl objects for shape */
	Context.prototype.setupShape = function (gl, shape, viewarea) 
	{
        var q = 0;
        
        if (shape._webgl !== undefined)
        {
			var oldLightsAndShadow = shape._webgl.lightsAndShadow
			shape._webgl.lightsAndShadow = useLightingFunc(viewarea);
			
            var needFullReInit = (shape._webgl.lightsAndShadow[0] != oldLightsAndShadow[0] || 
                                  shape._webgl.lightsAndShadow[1] != oldLightsAndShadow[1]);
			        
            if (shape._dirty.texture === true || needFullReInit)
            {	
                var tex = shape._cf.appearance.node._cf.texture.node;
                
                if ((shape._webgl.texture !== undefined && tex) && !needFullReInit)
                {
                	shape.updateTexture(tex, 0);
                    
                    shape._dirty.texture = false;
                }
                else
                {
                    needFullReInit = true;
                    
                    // clean-up old state before creating new shader
                    var spOld = shape._webgl.shader;
                    var inc = 0;
                    
                    for (inc=0; shape._webgl.texture !== undefined && 
                         inc < shape._webgl.texture.length; inc++)
                    {
                        if (shape._webgl.texture[inc])
                        {
                            gl.deleteTexture(shape._webgl.texture[inc]);
                        }
                    }
                    
                    for (var q=0; q<shape._webgl.positions.length; q++)
                    {
                        if (spOld.position !== undefined) 
                        {
                            gl.deleteBuffer(shape._webgl.buffers[5*q+1]);
                            gl.deleteBuffer(shape._webgl.buffers[5*q+0]);
                        }
                        
                        if (spOld.normal !== undefined) 
                        {
                            gl.deleteBuffer(shape._webgl.buffers[5*q+2]);
                        }
                        
                        if (spOld.texcoord !== undefined) 
                        {
                            gl.deleteBuffer(shape._webgl.buffers[5*q+3]);
                        }
                        
                        if (spOld.color !== undefined)
                        {
                            gl.deleteBuffer(shape._webgl.buffers[5*q+4]);
                        }
                    }
                    
                    for (inc=0; inc<shape._webgl.dynamicFields.length; inc++)
                    {
                        var h_attrib = shape._webgl.dynamicFields[inc];
                        
                        if (spOld[h_attrib.name] !== undefined)
                        {
                            gl.deleteBuffer(h_attrib.buf);
                        }
                    }
                }
            }
            
            for (q=0; q<shape._webgl.positions.length; q++)
            {
              if (!needFullReInit && shape._dirty.positions === true)
              {
                if (shape._webgl.shader.position !== undefined) 
                {
                    shape._webgl.positions = shape._cf.geometry.node._mesh._positions[q];
                    
                    // TODO; don't delete but use glMapBuffer() and DYNAMIC_DRAW
                    gl.deleteBuffer(shape._webgl.buffers[5*q+1]);
                    
                    var positionBuffer = gl.createBuffer();
                    shape._webgl.buffers[5*q+1] = positionBuffer;
                    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                    
                    var vertices = new Float32Array(shape._webgl.positions);
                    
                    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
                    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                    
                    gl.vertexAttribPointer(shape._webgl.shader.position, 3, gl.FLOAT, false, 0, 0);
                    
                    delete vertices;
                }
                
                shape._dirty.positions = false;
              }
              if (!needFullReInit && shape._dirty.colors === true)
              {
                if (shape._webgl.shader.color !== undefined)
                {
                    shape._webgl.colors = shape._cf.geometry.node._mesh._colors[q];
                    
                    gl.deleteBuffer(shape._webgl.buffers[5*q+4]);
                    
                    var colorBuffer = gl.createBuffer();
                    shape._webgl.buffers[5*q+4] = colorBuffer;
                    
                    var colors = new Float32Array(shape._webgl.colors);
                    
                    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
                    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);				
                    
                    gl.vertexAttribPointer(shape._webgl.shader.color, 3, gl.FLOAT, false, 0, 0); 
                    
                    delete colors;
                }
                
                shape._dirty.colors = false;
              }
              //TODO; check all other cases, too!
            }
            
            if (!needFullReInit)
                return;
        }
        else if (!x3dom.isa(shape._cf.geometry.node, x3dom.nodeTypes.Text) &&
                (shape._cf.geometry.node._mesh._positions[0].length < 1)) {
            x3dom.debug.logInfo("MINEFIELD BUG IN EXTENDING ARRAY: NO VALID POSITIONS SET!");
            return;
        }
        
        // we're on init, thus reset all dirty flags
        shape._dirty.positions = false;
		shape._dirty.normals = false;
		shape._dirty.texcoords = false;
        shape._dirty.colors = false;
		shape._dirty.indexes = false;
		shape._dirty.texture = false;
 
        // TODO; finish text!
		if (x3dom.isa(shape._cf.geometry.node, x3dom.nodeTypes.Text)) 
        {
            var text_canvas = document.createElement('canvas');
            text_canvas.width = 512;
            text_canvas.height = 128;
            //document.body.appendChild(text_canvas);	//dbg
            
			var text_ctx = text_canvas.getContext('2d');
			var fontStyle = shape._cf.geometry.node._cf.fontStyle.node;
			var font_family = 'SANS';
            if (fontStyle !== null) {
                font_family = Array.map(fontStyle._vf.family, function (s) {
                    if (s == 'SANS') { return 'sans-serif'; }
                    else if (s == 'SERIF') { return 'serif'; }
                    else if (s == 'TYPEWRITER') { return 'monospace'; }
                    else { return '"'+s+'"'; }  //'Verdana' 
                }).join(', ');
            }
			/*text_ctx.mozTextStyle = '48px '+font_family;*/
            
			var string = shape._cf.geometry.node._vf.string;
			/*
			var text_w = 0;
            var i = 0;
            for (i = 0; i < string.length; ++i) {
				text_w = Math.max(text_w, text_ctx.mozMeasureText(string[i]));
            }
            */
            
            text_ctx.fillStyle = 'rgba(0,0,0,0)';
            text_ctx.fillRect(0, 0, text_ctx.canvas.width, text_ctx.canvas.height);
             
            // write white text with black border
            text_ctx.fillStyle = 'white';
            text_ctx.lineWidth = 2.5;
            text_ctx.strokeStyle = 'grey';
            text_ctx.save();
            text_ctx.font = "32px " + font_family;  //bold 
            var txtW = text_ctx.measureText(string).width;
            var txtH = text_ctx.measureText(string).height || 60;
            var leftOffset = (text_ctx.canvas.width - txtW) / 2.0;
            var topOffset = (text_ctx.canvas.height - 32) / 2.0;
            //text_ctx.strokeText(string, leftOffset, topOffset);
            text_ctx.fillText(string, leftOffset, topOffset);
            text_ctx.restore();
            
            /*
			var line_h = 1.2 * text_ctx.mozMeasureText('M'); // XXX: this is a hacky guess
			var text_h = line_h * shape._cf.geometry.node._string.length;
			text_canvas.width = Math.pow(2, Math.ceil(Math.log(text_w)/Math.log(2)));
			text_canvas.height = Math.pow(2, Math.ceil(Math.log(text_h)/Math.log(2)));
			text_ctx.fillStyle = '#000';
			text_ctx.translate(0, line_h);
			for (i = 0; i < string.length; ++i) {
				text_ctx.mozDrawText(string[i]);
				text_ctx.translate(0, line_h);
			}
            */
			
			var ids = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, ids);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, text_canvas);
            
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            gl.bindTexture(gl.TEXTURE_2D, null);
			
			var w = txtW/100.0; //txtW/txtH;
			var h = txtH/100.0;
            var u0 = leftOffset / text_canvas.width;
			var u = u0 + txtW / text_canvas.width;
			var v = 1 - txtH / text_canvas.height;
            var v0 = topOffset / text_canvas.height + v;
            if (u0 < 0) { u0 = 0; }
            if (u > 1) { u = 1; }
            //x3dom.debug.logInfo(txtW + ", " + txtH + "; " + u0 + ", " + v0 + "; " + u + ", " + v);
            
            shape._cf.geometry.node._mesh._positions[0] = [-w,-h,0, w,-h,0, w,h,0, -w,h,0];
			shape._cf.geometry.node._mesh._normals[0] = [0,0,1, 0,0,1, 0,0,1, 0,0,1];
			shape._cf.geometry.node._mesh._texCoords[0] = [u0,v, u,v, u,v0, u0,v0];
			shape._cf.geometry.node._mesh._colors[0] = [];
			shape._cf.geometry.node._mesh._indices[0] = [0,1,2, 2,3,0];
            shape._cf.geometry.node._mesh._invalidate = true;
            shape._cf.geometry.node._mesh._numFaces = 2;
            shape._cf.geometry.node._mesh._numCoords = 4;
                
			shape._webgl = {
				positions: shape._cf.geometry.node._mesh._positions,
				normals: shape._cf.geometry.node._mesh._normals,
				texcoords: shape._cf.geometry.node._mesh._texCoords,
                colors: shape._cf.geometry.node._mesh._colors,
				indexes: shape._cf.geometry.node._mesh._indices,
				texture: [ids],
                //buffers: [{},{},{},{},{}],
				lightsAndShadow: useLightingFunc(viewarea)
			};

            shape._webgl.primType = gl.TRIANGLES;
			var vsID = this.generateVS(viewarea, false, true, false, shape._webgl.lightsAndShadow);
			var fsID = this.generateFS(viewarea, false, true, shape._webgl.lightsAndShadow);
			shape._webgl.shader = this.getShaderProgram(gl, [vsID, fsID]);
		}
		else 
		{
            var context = this;
			var tex = shape._cf.appearance.node._cf.texture.node;
            
            shape.updateTexture = function(tex, unit)
            {
                var that = this;
                var texture;
                var childTex = (tex._video !== undefined && 
                                tex._video !== null && 
                                tex._needPerFrameUpdate !== undefined && 
                                tex._needPerFrameUpdate === true);
                
                if (this._webgl.texture === undefined) {
                    this._webgl.texture = [];
                }
                
                if (tex._isCanvas && tex._canvas) {
                    texture = gl.createTexture();
                    that._webgl.texture[unit] = texture;
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex._canvas);
                    
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                }
                else if (x3dom.isa(tex, x3dom.nodeTypes.RenderedTexture))
                {
                    that._webgl.texture[unit] = tex._webgl.fbo.tex;
                    gl.bindTexture(gl.TEXTURE_2D, tex._webgl.fbo.tex);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                }
                else if (x3dom.isa(tex, x3dom.nodeTypes.PixelTexture))
                {
                    var pixels = new Uint8Array(tex._vf.image.toGL());
                    
                    var format = gl.NONE;
                    switch (tex._vf.image.comp)
                    {
                        case 1: format = gl.LUMINANCE; break;
                        case 2: format = gl.LUMINANCE_ALPHA; break;
                        case 3: format = gl.RGB; break;
                        case 4: format = gl.RGBA; break;
                    }
                    
                    texture = gl.createTexture();
                    that._webgl.texture[unit] = texture;
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    
                    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
                    gl.texImage2D(gl.TEXTURE_2D, 0, format, 
                            tex._vf.image.width, tex._vf.image.height, 0, 
                            format, gl.UNSIGNED_BYTE, pixels);
                }
                else if (x3dom.isa(tex, x3dom.nodeTypes.MultiTexture))
                {
                    for (var cnt=0; cnt<tex.size(); cnt++)
                    {
                        var singleTex = tex.getTexture(cnt);
                        if (!singleTex)
                            break;
                        that.updateTexture(singleTex, cnt);
                    }
                }
                else if (x3dom.isa(tex, x3dom.nodeTypes.MovieTexture) || childTex)
                {
                    texture = gl.createTexture();
                    
                    if (!childTex)
                    {
                        tex._video = document.createElement('video');
                        tex._video.setAttribute('autobuffer', 'true');
                        //tex._video.setAttribute('src', tex._vf.url);
                        var p = document.getElementsByTagName('body')[0];
                        p.appendChild(tex._video);
                        tex._video.style.display = "none";
                    }
                    
                    for (var i=0; i<tex._vf.url.length; i++)
                    {
                        var videoUrl = tex._nameSpace.getURL(tex._vf.url[i]);
                        x3dom.debug.logInfo('Adding video file: ' + videoUrl);
                        var src = document.createElement('source');
                        src.setAttribute('src', videoUrl);
                        tex._video.appendChild(src);
                    }
                    
                    var updateMovie = function()
                    {
						that._nameSpace.doc.needRender = true;			
	
                        gl.bindTexture(gl.TEXTURE_2D, texture);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex._video);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                        //gl.generateMipmap(gl.TEXTURE_2D);
                        gl.bindTexture(gl.TEXTURE_2D, null);
                    };
                    
                    var startVideo = function()
                    {
						that._nameSpace.doc.needRender = true;			
						
                        that._webgl.texture[unit] = texture;
                        //x3dom.debug.logInfo(texture + " video tex url: " + tex._vf.url);
                        
                        tex._video.play();
                        tex._intervalID = setInterval(updateMovie, 16);
                    };
                    
                    var videoDone = function()
                    {
                        clearInterval(tex._intervalID);
                        
                        if (tex._vf.loop === true)
                        {
                            tex._video.play();
                            tex._intervalID = setInterval(updateMovie, 16);
                        }
                    };
                    
                    // Start listening for the canplaythrough event, so we do not
                    // start playing the video until we can do so without stuttering
                    tex._video.addEventListener("canplaythrough", startVideo, true);

                    // Start listening for the ended event, so we can stop the
                    // texture update when the video is finished playing
                    tex._video.addEventListener("ended", videoDone, true);
                }
                else if (x3dom.isa(tex, x3dom.nodeTypes.X3DEnvironmentTextureNode))
                {
                    texture = context.loadCubeMap(gl, tex.getTexUrl(), that._nameSpace.doc, false);
                    that._webgl.texture[unit] = texture;
                }
                else
                {
                    texture = gl.createTexture();
                    
                    var image = new Image();
                    image.src = tex._nameSpace.getURL(tex._vf.url[0]);
                    that._nameSpace.doc.downloadCount += 1;

                    image.onload = function()
                    {			
						if(tex._vf.scale){
							image = scaleImage(image);
						}
						
						that._nameSpace.doc.needRender = true;
						that._nameSpace.doc.downloadCount -= 1;
						
                        that._webgl.texture[unit] = texture;
                        //x3dom.debug.logInfo(texture + " load tex url: " + tex._vf.url);
                        
                        gl.bindTexture(gl.TEXTURE_2D, texture);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                        //gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
                        //gl.generateMipmap(gl.TEXTURE_2D);
                        gl.bindTexture(gl.TEXTURE_2D, null);
                    };
                }
            };
            
			shape._webgl = {
				positions: shape._cf.geometry.node._mesh._positions,
				normals: shape._cf.geometry.node._mesh._normals,
				texcoords: shape._cf.geometry.node._mesh._texCoords,
				colors: shape._cf.geometry.node._mesh._colors,
				indexes: shape._cf.geometry.node._mesh._indices,
				//indicesBuffer,positionBuffer,normalBuffer,texcBuffer,colorBuffer
				//buffers: [{},{},{},{},{}],
				lightsAndShadow: useLightingFunc(viewarea)
			};
			
            if (tex) {
                shape.updateTexture(tex, 0);
			}
            
            if (x3dom.isa(shape._cf.geometry.node, x3dom.nodeTypes.PointSet)) {
                shape._webgl.primType = gl.POINTS;
                
                //TODO; remove these hacky thousands of shaders!!!
                if (shape._webgl.colors[0].length) {
                    shape._webgl.shader = this.getShaderProgram(gl, 
                                          ['vs-x3d-vertexcolorUnlit', 'fs-x3d-vertexcolorUnlit']);
					
                }
                else {
                    shape._webgl.shader = this.getShaderProgram(gl, 
                                          ['vs-x3d-default', 'fs-x3d-default']);
                }
            }
            else if (x3dom.isa(shape._cf.geometry.node, x3dom.nodeTypes.IndexedLineSet)) {
                shape._webgl.primType = gl.LINES;
                
                if (shape._webgl.colors[0].length) {
                    shape._webgl.shader = this.getShaderProgram(gl, 
                                          ['vs-x3d-vertexcolorUnlit', 'fs-x3d-vertexcolorUnlit']);
                }
                else {
                    shape._webgl.shader = this.getShaderProgram(gl, 
                                          ['vs-x3d-default', 'fs-x3d-default']);
                }
            }
            else {
                //TODO; also account for other cases such as LineSet
                shape._webgl.primType = gl.TRIANGLES;
                
                /** SHADER HACK (TODO: MAKE BETTER!) */
                if (shape._cf.appearance.node._shader !== null) {
					if(x3dom.isa(shape._cf.appearance.node._shader, x3dom.nodeTypes.CommonSurfaceShader)){
						var vsID = this.generateVS(viewarea, false, false, false, shape._webgl.lightsAndShadow);
						var fsID = this.generateFS(viewarea, false, false, shape._webgl.lightsAndShadow);
						shape._webgl.shader = this.getShaderProgram(gl, [vsID, fsID]);
					}else{
						//FIXME; HACK
						g_shaders['vs-x3d-HACK'] = {};
						g_shaders['vs-x3d-HACK'].type = "vertex";
						g_shaders['vs-x3d-HACK'].data = shape._cf.appearance.node._shader._vertex._vf.url[0];
						g_shaders['fs-x3d-HACK'] = {};
						g_shaders['fs-x3d-HACK'].type = "fragment";
						g_shaders['fs-x3d-HACK'].data = shape._cf.appearance.node._shader._fragment._vf.url[0];
					
						shape._webgl.shader = getDefaultShaderProgram(gl, 'HACK');
						//END OF HACK
					}
                }
                else {
                /** BEGIN STANDARD MATERIAL */
                if (tex) {
                    if (shape._cf.appearance.node._cf.textureTransform.node === null) {
						var vsID = this.generateVS(viewarea, false, true, false, shape._webgl.lightsAndShadow);
						var fsID = this.generateFS(viewarea, false, true, shape._webgl.lightsAndShadow);
						shape._webgl.shader = this.getShaderProgram(gl, [vsID, fsID]);
					}
                    else {
                        var vsID = this.generateVS(viewarea, false, true, true, shape._webgl.lightsAndShadow);
						var fsID = this.generateFS(viewarea, false, true, shape._webgl.lightsAndShadow);
						shape._webgl.shader = this.getShaderProgram(gl, [vsID, fsID]);
					}
                }
                else if (shape._cf.geometry.node._mesh._colors[0].length > 0) {
					
					var numColComponents = shape._cf.geometry.node._mesh._numColComponents;
				
					var vsID = this.generateVS(viewarea, numColComponents, false, false, shape._webgl.lightsAndShadow);
					var fsID = this.generateFS(viewarea, numColComponents, false, shape._webgl.lightsAndShadow);
					shape._webgl.shader = this.getShaderProgram(gl, [vsID, fsID]);
				}
                else {
					var vsID = this.generateVS(viewarea, false, false, false, shape._webgl.lightsAndShadow);
					var fsID = this.generateFS(viewarea, false, false, shape._webgl.lightsAndShadow);
					shape._webgl.shader = this.getShaderProgram(gl, [vsID, fsID]);
				}
                /** END STANDARD MATERIAL */
                }
            }
        }
		
        var sp = shape._webgl.shader;
        
        shape._webgl.buffers = [];
            
        for (q=0; q<shape._webgl.positions.length; q++)
        {
          if (sp.position !== undefined) 
          {
            // bind indices for drawElements() call
            var indicesBuffer = gl.createBuffer();
            shape._webgl.buffers[5*q+0] = indicesBuffer;
            
            var indexArray = new Uint16Array(shape._webgl.indexes[q]);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
            
            delete indexArray;
            
            var positionBuffer = gl.createBuffer();
            shape._webgl.buffers[5*q+1] = positionBuffer;
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            
            var vertices = new Float32Array(shape._webgl.positions[q]);
            
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            
            gl.vertexAttribPointer(sp.position, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(sp.position);
            
            delete vertices;
          }
          if (sp.normal !== undefined) 
          {
            var normalBuffer = gl.createBuffer();
            shape._webgl.buffers[5*q+2] = normalBuffer;
            
            var normals = new Float32Array(shape._webgl.normals[q]);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);				
            
            gl.vertexAttribPointer(sp.normal, 3, gl.FLOAT, false, 0, 0); 
            gl.enableVertexAttribArray(sp.normal);
            
            delete normals;
          }
          if (sp.texcoord !== undefined)
          {
            var texcBuffer = gl.createBuffer();
            shape._webgl.buffers[5*q+3] = texcBuffer;
            
            var texCoords = new Float32Array(shape._webgl.texcoords[q]);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, texcBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
            
            gl.vertexAttribPointer(sp.texcoord, 
                shape._cf.geometry.node._mesh._numTexComponents, gl.FLOAT, false, 0, 0); 
            gl.enableVertexAttribArray(sp.texcoord);
            
            delete texCoords;
          }
          if (sp.color !== undefined)
          {
            var colorBuffer = gl.createBuffer();
            shape._webgl.buffers[5*q+4] = colorBuffer;
            
            var colors = new Float32Array(shape._webgl.colors[q]);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);				
            
            gl.vertexAttribPointer(sp.color, 
                shape._cf.geometry.node._mesh._numColComponents, gl.FLOAT, false, 0, 0); 
            gl.enableVertexAttribArray(sp.color);
            
            delete colors;
          }
        }
        
        var currAttribs = 0;
        shape._webgl.dynamicFields = [];
        
        // TODO; FIXME; what if geometry with split mesh has dynamic fields?
        for (var df in shape._cf.geometry.node._mesh._dynamicFields)
        {
            var attrib = shape._cf.geometry.node._mesh._dynamicFields[df];
            
            shape._webgl.dynamicFields[currAttribs] = {
                  buf: {}, name: df, numComponents: attrib.numComponents };
            
            if (sp[df] !== undefined)
            {
                var attribBuffer = gl.createBuffer();
                shape._webgl.dynamicFields[currAttribs++].buf = attribBuffer;
                
                var attribs = new Float32Array(attrib.value);
                
                gl.bindBuffer(gl.ARRAY_BUFFER, attribBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, attribs, gl.STATIC_DRAW);				
                
                gl.vertexAttribPointer(sp[df], attrib.numComponents, gl.FLOAT, false, 0, 0); 
                
                delete attribs;
            }
        }
	};
    
    // mainly manages rendering of backgrounds and buffer clearing
	Context.prototype.setupScene = function(gl, bgnd) 
	{
        if (bgnd._webgl !== undefined)
        {
            if (!bgnd._dirty) {
                return;
            }
            
            if (bgnd._webgl.texture !== undefined && bgnd._webgl.texture)
            {
                gl.deleteTexture(bgnd._webgl.texture);
            }
            if (bgnd._webgl.shader.position !== undefined) 
            {
                gl.deleteBuffer(bgnd._webgl.buffers[1]);
                gl.deleteBuffer(bgnd._webgl.buffers[0]);
            }
            bgnd._webgl = {};
        }
        
        bgnd._dirty = false;
        
        var url = bgnd.getTexUrl();
        var i = 0;
        var w = 1, h = 1;
        
        if (url.length > 0 && url[0].length > 0)
        {
            if (url.length >= 6 && url[1].length > 0 && url[2].length > 0 && 
                url[3].length > 0 && url[4].length > 0 && url[5].length > 0)
            {
                var sphere = new x3dom.nodeTypes.Sphere();
                
                bgnd._webgl = {
                    positions: sphere._mesh._positions[0],
                    indexes: sphere._mesh._indices[0],
                    buffers: [{}, {}]
                };
                
                bgnd._webgl.primType = gl.TRIANGLES;
                bgnd._webgl.shader = this.getShaderProgram(gl, 
                        ['vs-x3d-bg-textureCube', 'fs-x3d-bg-textureCube']);
                
                bgnd._webgl.texture = this.loadCubeMap(gl, url, bgnd._nameSpace.doc, true);
            }
            else
            {
                var texture = gl.createTexture();
                
                var image = new Image();
                image.src = url[0];
                bgnd._nameSpace.doc.downloadCount += 1;
                
                image.onload = function()
                {
					bgnd._nameSpace.doc.needRender = true;
					bgnd._nameSpace.doc.downloadCount -= 1;
                    
                    bgnd._webgl.texture = texture;
                    //x3dom.debug.logInfo(texture + " load tex url: " + url[0]);
                    
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                };
                
                bgnd._webgl = {
                    positions: [-w,-h,0, -w,h,0, w,-h,0, w,h,0],
                    indexes: [0, 1, 2, 3],
                    buffers: [{}, {}]
                };

                bgnd._webgl.primType = gl.TRIANGLE_STRIP;
                bgnd._webgl.shader = this.getShaderProgram(gl, 
                        ['vs-x3d-bg-texture', 'fs-x3d-bg-texture']);
            }
		}
		else 
		{
            // TODO; impl. gradient bg etc., e.g. via canvas 2d?
            bgnd._webgl = {};
        }
        
        if (bgnd._webgl.shader)
		{
            var sp = bgnd._webgl.shader;
            
            var positionBuffer = gl.createBuffer();
            bgnd._webgl.buffers[1] = positionBuffer;
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            
            var vertices = new Float32Array(bgnd._webgl.positions);
            
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            
            gl.vertexAttribPointer(sp.position, 3, gl.FLOAT, false, 0, 0);
            
            var indicesBuffer = gl.createBuffer();
            bgnd._webgl.buffers[0] = indicesBuffer;
            
            var indexArray = new Uint16Array(bgnd._webgl.indexes);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
            
            delete vertices;
            delete indexArray;
        }
        
        bgnd._webgl.render = function(gl, mat_scene)
        {
            var sp = bgnd._webgl.shader;
            
            if (!bgnd._webgl.texture || !sp ||
                (bgnd._webgl.texture.textureCubeReady !== undefined && 
                 bgnd._webgl.texture.textureCubeReady !== true))
            {
            	var bgCol = bgnd.getSkyColor().toGL();
                bgCol[3] = 1.0 - bgnd.getTransparency();
                
                gl.clearColor(bgCol[0], bgCol[1], bgCol[2], bgCol[3]);
                gl.clearDepth(1.0);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
            }
            else
            {
                gl.clearDepth(1.0);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
                
                gl.frontFace(gl.CCW);
                gl.disable(gl.CULL_FACE);
                gl.disable(gl.DEPTH_TEST);
                gl.disable(gl.BLEND);
                
                sp.bind();
                if (!sp.tex) {
                    sp.tex = 0;
                }
                
                if (bgnd._webgl.texture.textureCubeReady) {
                    sp.modelViewProjectionMatrix = mat_scene.toGL();
                    
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, bgnd._webgl.texture);
                    
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                }
                else {
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, bgnd._webgl.texture);
                    
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                }
                
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bgnd._webgl.buffers[0]);
				gl.bindBuffer(gl.ARRAY_BUFFER, bgnd._webgl.buffers[1]);
				gl.vertexAttribPointer(sp.position, 3, gl.FLOAT, false, 0, 0);
				gl.enableVertexAttribArray(sp.position);
                
                try {
                    gl.drawElements(bgnd._webgl.primType, bgnd._webgl.indexes.length, gl.UNSIGNED_SHORT, 0);
                }
                catch(e) {
                    x3dom.debug.logException("Render background: " + e);
                }
                
                gl.disableVertexAttribArray(sp.position);
                
                if (bgnd._webgl.texture.textureCubeReady) {
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                }
                else {
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                }
                
                gl.clear(gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
            }
        };
	};
    
    // setup dbg fgnds
    Context.prototype.setupFgnds = function (gl, scene)
    {
        if (scene._fgnd !== undefined) {
            return;
        }
        
        var w = 1, h = 1;
        scene._fgnd = {};
        
        scene._fgnd._webgl = {
            positions: [-w,-h,0, -w,h,0, w,-h,0, w,h,0],
            indexes: [0, 1, 2, 3],
            buffers: [{}, {}]
        };

        scene._fgnd._webgl.primType = gl.TRIANGLE_STRIP;
        scene._fgnd._webgl.shader = this.getShaderProgram(gl, 
                ['vs-x3d-bg-texture', 'fs-x3d-bg-texture']);
        
        var sp = scene._fgnd._webgl.shader;
        
        var positionBuffer = gl.createBuffer();
        scene._fgnd._webgl.buffers[1] = positionBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        
        var vertices = new Float32Array(scene._fgnd._webgl.positions);
        
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        
        gl.vertexAttribPointer(sp.position, 3, gl.FLOAT, false, 0, 0);
        
        var indicesBuffer = gl.createBuffer();
        scene._fgnd._webgl.buffers[0] = indicesBuffer;
        
        var indexArray = new Uint16Array(scene._fgnd._webgl.indexes);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
        
        delete vertices;
        delete indexArray;
        
        scene._fgnd._webgl.render = function(gl, tex)
        {
            scene._fgnd._webgl.texture = tex;
            
            gl.frontFace(gl.CCW);
            gl.disable(gl.CULL_FACE);
            gl.disable(gl.DEPTH_TEST);
            
            sp.bind();
            if (!sp.tex) {
                sp.tex = 0;
            }
            
            //gl.enable(gl.TEXTURE_2D);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, scene._fgnd._webgl.texture);
            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, scene._fgnd._webgl.buffers[0]);
            gl.bindBuffer(gl.ARRAY_BUFFER, scene._fgnd._webgl.buffers[1]);
            gl.vertexAttribPointer(sp.position, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(sp.position);
            
            try {
                gl.drawElements(scene._fgnd._webgl.primType, 
                                scene._fgnd._webgl.indexes.length, gl.UNSIGNED_SHORT, 0);
            }
            catch(e) {
                x3dom.debug.logException("render background: " + e);
            }
            
            gl.disableVertexAttribArray(sp.position);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, null);
            //gl.disable(gl.TEXTURE_2D);
        };
    };
    
    Context.prototype.renderShadowPass = function(gl, scene, mat_light, mat_scene)
    {
        gl.bindFramebuffer(gl.FRAMEBUFFER, scene._webgl.fboShadow.fbo);
        
        gl.viewport(0, 0, scene._webgl.fboShadow.width, scene._webgl.fboShadow.height);
        
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        
        var sp = scene._webgl.shadowShader;
        sp.bind();
        
        //var mat_light = scene.getLightMatrix();
        //var mat_scene = scene.getWCtoLCMatrix();
        var i, n = scene.drawableObjects.length;
        
        for (i=0; i<n; i++)
        {
			var trafo = scene.drawableObjects[i][0];
			var shape = scene.drawableObjects[i][1];
            
			sp.modelViewMatrix = mat_light.mult(trafo).toGL();
			sp.modelViewProjectionMatrix = mat_scene.mult(trafo).toGL();
            
            for (var q=0; q<shape._webgl.positions.length; q++)
            {
                if (sp.position !== undefined) 
                {
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shape._webgl.buffers[5*q+0]);
                    
                    gl.bindBuffer(gl.ARRAY_BUFFER, shape._webgl.buffers[5*q+1]);
                    
                    gl.vertexAttribPointer(sp.position, 3, gl.FLOAT, false, 0, 0);
                    gl.enableVertexAttribArray(sp.position);
                }
                
                try {
                    if (shape._webgl.indexes && shape._webgl.indexes[q])
                    gl.drawElements(shape._webgl.primType, shape._webgl.indexes[q].length, gl.UNSIGNED_SHORT, 0);
                }
                catch (e) {
                    x3dom.debug.logException(shape._DEF + " renderShadowPass(): " + e);
                }
                
                if (sp.position !== undefined) {
                    gl.disableVertexAttribArray(sp.position);
                }
            }
        }
        gl.flush();
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
    
    
    Context.prototype.renderPickingPass = function(gl, scene, mat_view, mat_scene, 
                                                   min, max, pickMode, lastX, lastY)
    {
        gl.bindFramebuffer(gl.FRAMEBUFFER, scene._webgl.fboPick.fbo);
        
        gl.viewport(0, 0, scene._webgl.fboPick.width, scene._webgl.fboPick.height);
        
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        
        var sp;
        if (pickMode === 0)
            { sp = scene._webgl.pickShader; }
        else if (pickMode === 1)
            { sp = scene._webgl.pickColorShader; }
        else if (pickMode === 2)
            { sp = scene._webgl.pickTexCoordShader; }
        sp.bind();
        
        var i, n = scene.drawableObjects.length;
        
        for (i=0; i<n; i++)
        {
			var trafo = scene.drawableObjects[i][0];
			var shape = scene.drawableObjects[i][1];
            
            if (shape._objectID < 1 || shape._webgl === undefined)
                continue;
            
            sp.modelMatrix = trafo.toGL();
			//sp.modelMatrix = mat_view.mult(trafo).toGL();
			sp.modelViewProjectionMatrix = mat_scene.mult(trafo).toGL();
            
            sp.wcMin = min.toGL();
            sp.wcMax = max.toGL();
            //FIXME; allow more than 255 objects!
            sp.alpha = 1.0 - shape._objectID / 255.0;
            
            for (var q=0; q<shape._webgl.positions.length; q++)
            {
                if (sp.position !== undefined) 
                {
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shape._webgl.buffers[5*q+0]);
                    
                    gl.bindBuffer(gl.ARRAY_BUFFER, shape._webgl.buffers[5*q+1]);
                    
                    gl.vertexAttribPointer(sp.position, 3, gl.FLOAT, false, 0, 0);
                    gl.enableVertexAttribArray(sp.position);
                }
                //  **********************
                if (sp.color !== undefined)
                {
                    gl.bindBuffer(gl.ARRAY_BUFFER, shape._webgl.buffers[5*q+4]);
                    
                    gl.vertexAttribPointer(sp.color, 3, gl.FLOAT, false, 0, 0); 
                    gl.enableVertexAttribArray(sp.color);
                }
                if (sp.texcoord !== undefined)
                {
                    gl.bindBuffer(gl.ARRAY_BUFFER, shape._webgl.buffers[5*q+3]);

                    gl.vertexAttribPointer(sp.texcoord, 
                        shape._cf.geometry.node._mesh._numTexComponents, gl.FLOAT, false, 0, 0); 
                    gl.enableVertexAttribArray(sp.texcoord);
                }
                
                if (shape.isSolid()) {
                    gl.enable(gl.CULL_FACE);
                    
                    if (shape.isCCW()) {
                        gl.frontFace(gl.CCW);
                    }
                    else {
                        gl.frontFace(gl.CW);
                    }
                }
                else {
                    gl.disable(gl.CULL_FACE);
                }
                
                try {
                    if (shape._webgl.indexes && shape._webgl.indexes[q])
                    gl.drawElements(shape._webgl.primType, shape._webgl.indexes[q].length, gl.UNSIGNED_SHORT, 0);
                }
                catch (e) {
                    x3dom.debug.logException(shape._DEF + " renderPickingPass(): " + e);
                }
                
                if (sp.position !== undefined) {
                    gl.disableVertexAttribArray(sp.position);
                }
                //  **********************
                if (sp.color !== undefined) {
                    gl.disableVertexAttribArray(sp.color);
                }
                if (sp.texcoord !== undefined) {
                    gl.disableVertexAttribArray(sp.texcoord);
                }
            }
        }
        gl.flush();
        
        try {
            var x = lastX * scene._webgl.pickScale,
                y = scene._webgl.fboPick.height - 1 - lastY * scene._webgl.pickScale;
            var data = new Uint8Array(4);    // 4 = 1 * 1 * 4
            
            gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
            
            scene._webgl.fboPick.pixelData = data;
        }
        catch(se) {
            scene._webgl.fboPick.pixelData = [];
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
	
    /** render single object/ shape */
	Context.prototype.renderShape = function (transform, shape, viewarea, 
                                              slights, numLights, 
                                              mat_view, mat_scene, mat_light, 
                                              gl, activeTex, oneShadowExistsAlready)
	{
        if (shape._webgl === undefined) {
            return;
        }
        
        var scene = viewarea._scene;
        
		var sp = shape._webgl.shader;
		if (!sp) {
			shape._webgl.shader = getDefaultShaderProgram(gl, 'default');
			sp = shape._webgl.shader;
		}
		sp.bind();
		
		if (x3dom.isa(shape._cf.geometry.node, x3dom.nodeTypes.Text)){
			sp.useText = 1.0;
		}else{
			sp.useText = 0.0;
		}

		//===========================================================================
		// Set fog
		//===========================================================================
		var fog = scene.getFog();
		if(fog){
			sp['fog.color'] 			= fog._vf.color.toGL();
			sp['fog.visibilityRange'] 	= fog._vf.visibilityRange;
			if(fog._vf.fogType == "LINEAR") sp['fog.fogType'] = 0.0; 
			else sp['fog.fogType'] = 1.0;
		}
		
		//===========================================================================
		// Set Material
		//===========================================================================
		
		var mat = shape._cf.appearance.node._cf.material.node;			
		var shaderCSS = shape._cf.appearance.node._shader;
		
		if (shaderCSS !== null) {
			if(x3dom.isa(shaderCSS, x3dom.nodeTypes.CommonSurfaceShader)){
				sp['material.diffuseColor'] 	= shaderCSS._vf.diffuseFactor.toGL();
				sp['material.specularColor'] 	= shaderCSS._vf.specularFactor.toGL();
				sp['material.emissiveColor'] 	= shaderCSS._vf.emissiveFactor.toGL();
				sp['material.shininess'] 		= shaderCSS._vf.shininessFactor;
				sp['material.ambientIntensity'] = (shaderCSS._vf.ambientFactor.x + shaderCSS._vf.ambientFactor.y + shaderCSS._vf.ambientFactor.z)/3;
				sp['material.transparency'] 	= 1.0 - shaderCSS._vf.alphaFactor;
			}
		}else{
			sp['material.diffuseColor'] 		= mat._vf.diffuseColor.toGL();
			sp['material.specularColor'] 		= mat._vf.specularColor.toGL();
			sp['material.emissiveColor'] 		= mat._vf.emissiveColor.toGL();
			sp['material.shininess'] 			= mat._vf.shininess;
			sp['material.ambientIntensity'] 	= mat._vf.ambientIntensity;
			sp['material.transparency'] 		= mat._vf.transparency;
		}
		
		//FIXME Only set for VertexColorUnlit and ColorPicking
		sp.alpha = 1.0 - mat._vf.transparency;
		
		//===========================================================================
		// Set Lights
		//===========================================================================
		if (numLights > 0)
		{
			if(numLights > 8){
				x3dom.debug.logInfo("Too many lights! Only 8 lights supported!");
				numLights = 8;
			}
			
			for(var p=0; p<numLights; p++){			
				if(x3dom.isa(slights[p], x3dom.nodeTypes.DirectionalLight))
				{
					//x3dom.debug.logInfo("DirectionalLight");
					sp['light[' + p + '].type']				= 0.0;
					sp['light[' + p + '].on']				= (slights[p]._vf.on) ? 1.0 : 0.0;
					sp['light[' + p + '].color'] 			= slights[p]._vf.color.toGL();
					sp['light[' + p + '].intensity']		= slights[p]._vf.intensity;
					sp['light[' + p + '].ambientIntensity']	= slights[p]._vf.ambientIntensity;
					sp['light[' + p + '].direction']		= mat_view.multMatrixVec(slights[p]._vf.direction).toGL();
					sp['light[' + p + '].attenuation']		= [1.0, 1.0, 1.0];
					sp['light[' + p + '].location']			= [1.0, 1.0, 1.0];
					sp['light[' + p + '].radius']			= 0.0;
					sp['light[' + p + '].beamWidth']		= 0.0;
					sp['light[' + p + '].cutOffAngle']		= 0.0;
					sp['light[' + p + '].shadowIntensity']	= slights[p]._vf.shadowIntensity;
				}
				else if(x3dom.isa(slights[p], x3dom.nodeTypes.PointLight))
				{
					//x3dom.debug.logInfo("PointLight");
					sp['light[' + p + '].type']				= 1.0;
					sp['light[' + p + '].on']				= (slights[p]._vf.on) ? 1.0 : 0.0;
					sp['light[' + p + '].color'] 			= slights[p]._vf.color.toGL();
					sp['light[' + p + '].intensity']		= slights[p]._vf.intensity;
					sp['light[' + p + '].ambientIntensity']	= slights[p]._vf.ambientIntensity;
					sp['light[' + p + '].direction']		= [1.0, 1.0, 1.0];
					sp['light[' + p + '].attenuation']		= slights[p]._vf.attenuation.toGL();
					sp['light[' + p + '].location']			= mat_view.multMatrixPnt(slights[p]._vf.location).toGL();
					sp['light[' + p + '].radius']			= slights[p]._vf.radius;
					sp['light[' + p + '].beamWidth']		= 0.0;
					sp['light[' + p + '].cutOffAngle']		= 0.0;
					sp['light[' + p + '].shadowIntensity']	= slights[p]._vf.shadowIntensity;
				}
				else if(x3dom.isa(slights[p], x3dom.nodeTypes.SpotLight))
				{
					//x3dom.debug.logInfo("SpotLight");
					sp['light[' + p + '].type']				= 2.0;
					sp['light[' + p + '].on']				= (slights[p]._vf.on) ? 1.0 : 0.0;
					sp['light[' + p + '].color'] 			= slights[p]._vf.color.toGL();
					sp['light[' + p + '].intensity']		= slights[p]._vf.intensity;
					sp['light[' + p + '].ambientIntensity']	= slights[p]._vf.ambientIntensity;
					sp['light[' + p + '].direction']		= mat_view.multMatrixVec(slights[p]._vf.direction).toGL();
					sp['light[' + p + '].attenuation']		= slights[p]._vf.attenuation.toGL();
					sp['light[' + p + '].location']			= mat_view.multMatrixPnt(slights[p]._vf.location).toGL();
					sp['light[' + p + '].radius']			= slights[p]._vf.radius;
					sp['light[' + p + '].beamWidth']		= slights[p]._vf.beamWidth;
					sp['light[' + p + '].cutOffAngle']		= slights[p]._vf.cutOffAngle;
					sp['light[' + p + '].shadowIntensity']	= slights[p]._vf.shadowIntensity;
				}
			}
		}
		
		//===========================================================================
		// Set HeadLight
		//===========================================================================
		var nav = scene.getNavigationInfo();
		if(nav._vf.headlight){
			sp['light[' + numLights + '].type']				= 0.0;
			sp['light[' + numLights + '].on']				= 1.0;
			sp['light[' + numLights + '].color'] 			= [1.0, 1.0, 1.0];
			sp['light[' + numLights + '].intensity']		= 1.0;
			sp['light[' + numLights + '].ambientIntensity']	= 0.0;
			sp['light[' + numLights + '].direction']		= [0.0, 0.0, -1.0];
			sp['light[' + numLights + '].attenuation']		= [1.0, 1.0, 1.0];
			sp['light[' + numLights + '].location']			= [1.0, 1.0, 1.0];
			sp['light[' + numLights + '].radius']			= 0.0;
			sp['light[' + numLights + '].beamWidth']		= 0.0;
			sp['light[' + numLights + '].cutOffAngle']		= 0.0;
		}
		
		var userShader = shape._cf.appearance.node._shader;
		if (userShader) {
			for (var fName in userShader._vf) {
				if (userShader._vf.hasOwnProperty(fName) && fName !== 'language') {
					var field = userShader._vf[fName];
					try {
						sp[fName] = field.toGL();
					}
					catch(noToGl) {
						sp[fName] = field;
					}
				}
			}
		}
		
		// transformation matrices
		// Calculate and Set Normalmatrix
        // For rigid motions the inverse-transpose is not necessary
		//var normalMatrix = mat_view.mult(transform);
		//normalMatrix = normalMatrix.inverse().transpose();
		//sp.normalMatrix = normalMatrix.toGL();
        
		var model_view = mat_view.mult(transform);
		sp.modelViewMatrix = model_view.toGL();
		if (userShader) {
			sp.modelViewMatrixInverse = model_view.inverse().toGL();
		}
		sp.modelViewProjectionMatrix = mat_scene.mult(transform).toGL();
		
		for (var cnt=0; shape._webgl.texture !== undefined && 
						cnt < shape._webgl.texture.length; cnt++)
		{
		  if (shape._webgl.texture[cnt])
		  {
			var tex = null;
			if (shape._cf.appearance.node._cf.texture.node) {
				tex = shape._cf.appearance.node._cf.texture.node.getTexture(cnt);
			}
			var wrapS = gl.REPEAT, wrapT = gl.REPEAT;
			if (tex && tex._vf.repeatS === false) {
				wrapS = gl.CLAMP_TO_EDGE;
			}
			if (tex && tex._vf.repeatT === false) {
				wrapT = gl.CLAMP_TO_EDGE;
			}
			
			if (shape._webgl.texture[cnt].textureCubeReady && tex && 
				x3dom.isa(tex, x3dom.nodeTypes.X3DEnvironmentTextureNode))
			{
				//gl.enable(gl.TEXTURE_CUBE_MAP);
				gl.activeTexture(activeTex[cnt]);
				gl.bindTexture(gl.TEXTURE_CUBE_MAP, shape._webgl.texture[cnt]);
				
				gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, wrapS);
				gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, wrapT);
				gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			}
			else
			{
				//gl.enable(gl.TEXTURE_2D);
				gl.activeTexture(activeTex[cnt]);
				gl.bindTexture(gl.TEXTURE_2D, shape._webgl.texture[cnt]);
				
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				//gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
				//gl.generateMipmap(gl.TEXTURE_2D);
			}
			
			if (shape._cf.appearance.node._cf.textureTransform.node !== null)
			{
				// use shader/ calculation due to performance issues
				var texTrafo = shape._cf.appearance.node.texTransformMatrix();
				sp.texTrafoMatrix = texTrafo.toGL();
			}
			
			if (shape._cf.geometry.node._cf.texCoord !== undefined &&
				shape._cf.geometry.node._cf.texCoord.node !== null &&
				shape._cf.geometry.node._cf.texCoord.node._vf.mode)
			{
				var texMode = shape._cf.geometry.node._cf.texCoord.node._vf.mode;
				if (texMode.toLowerCase() == "sphere") {
					sp.sphereMapping = 1.0;
				}
				else {
					sp.sphereMapping = 0.0;
				}
			}
			else {
				sp.sphereMapping = 0.0;
			}
			if (!sp.tex) {
				sp.tex = 0;     // FIXME; only 1st tex known in shader
			}
		  }
		}
		
		if (oneShadowExistsAlready) 
		{
			if (!sp.sh_tex) {
				sp.sh_tex = cnt;
			}
			gl.activeTexture(activeTex[cnt]);
			gl.bindTexture(gl.TEXTURE_2D, scene._webgl.fboShadow.tex);
			
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			//gl.generateMipmap(gl.TEXTURE_2D);
			
			sp.matPV = mat_light.mult(transform).toGL();
		}
		
        // TODO; FIXME; what if geometry with split mesh has dynamic fields?
		for (var df=0; df<shape._webgl.dynamicFields.length; df++)
		{
			var attrib = shape._webgl.dynamicFields[df];
			
			if (sp[attrib.name] !== undefined)
			{
				gl.bindBuffer(gl.ARRAY_BUFFER, attrib.buf);
				
				gl.vertexAttribPointer(sp[attrib.name], attrib.numComponents, gl.FLOAT, false, 0, 0); 
				gl.enableVertexAttribArray(sp[attrib.name]);
			}
		}
		
		if (shape.isSolid()) {
			gl.enable(gl.CULL_FACE);
			
			if (shape.isCCW()) {
				gl.frontFace(gl.CCW);
			}
			else {
				gl.frontFace(gl.CW);
			}
		}
		else {
			gl.disable(gl.CULL_FACE);
		}
		sp.solid = (shape.isSolid() ? 1.0 : 0.0);
        
        for (var q=0; q<shape._webgl.positions.length; q++)
        {
		  if (sp.position !== undefined)
		  {
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shape._webgl.buffers[5*q+0]);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, shape._webgl.buffers[5*q+1]);
			
			gl.vertexAttribPointer(sp.position, 3, gl.FLOAT, false, 0, 0);
			gl.enableVertexAttribArray(sp.position);
		  }
		  if (sp.normal !== undefined) 
		  {
			gl.bindBuffer(gl.ARRAY_BUFFER, shape._webgl.buffers[5*q+2]);			
			
			gl.vertexAttribPointer(sp.normal, 3, gl.FLOAT, false, 0, 0); 
			gl.enableVertexAttribArray(sp.normal);
		  }
		  if (sp.texcoord !== undefined)
		  {
			gl.bindBuffer(gl.ARRAY_BUFFER, shape._webgl.buffers[5*q+3]);
			
			gl.vertexAttribPointer(sp.texcoord, 
				shape._cf.geometry.node._mesh._numTexComponents, gl.FLOAT, false, 0, 0); 
			gl.enableVertexAttribArray(sp.texcoord);
		  }
		  if (sp.color !== undefined)
		  {
			gl.bindBuffer(gl.ARRAY_BUFFER, shape._webgl.buffers[5*q+4]);
			
			gl.vertexAttribPointer(sp.color, 
				shape._cf.geometry.node._mesh._numColComponents, gl.FLOAT, false, 0, 0); 
			gl.enableVertexAttribArray(sp.color);
		  }
		
            // render object
            try {
              // fixme; viewarea._points is dynamic and doesn't belong there!!!
              if (viewarea._points !== undefined && viewarea._points) {
                gl.drawElements(gl.POINTS, shape._webgl.indexes[q].length, gl.UNSIGNED_SHORT, 0);
              }
              else {
                // fixme; this differentiation isn't nice, but otherwise WebGL seems to run out of mem
                if (shape._webgl.primType == gl.POINTS) {
                    gl.drawArrays(gl.POINTS, 0, shape._webgl.positions[q].length/3);
                }
                else {
                    //x3dom.debug.logInfo("indexLength: " + shape._webgl.indexes[q].length);
                    if (shape._webgl.indexes && shape._webgl.indexes[q])
                    gl.drawElements(shape._webgl.primType, shape._webgl.indexes[q].length, gl.UNSIGNED_SHORT, 0);
                }
              }
            }
            catch (e) {
                x3dom.debug.logException(shape._DEF + " renderScene(): " + e);
            }
            
            if (sp.position !== undefined) {
                gl.disableVertexAttribArray(sp.position);
            }
            if (sp.normal !== undefined) {
                gl.disableVertexAttribArray(sp.normal);
            }
            if (sp.texcoord !== undefined) {
                gl.disableVertexAttribArray(sp.texcoord);
            }
            if (sp.color !== undefined) {
                gl.disableVertexAttribArray(sp.color);
            }
        }
        
        if (shape._webgl.indexes && shape._webgl.indexes[0])
            this.numFaces += shape._cf.geometry.node._mesh._numFaces;
        this.numCoords += shape._cf.geometry.node._mesh._numCoords;
		
		for (cnt=0; shape._webgl.texture !== undefined && 
					cnt < shape._webgl.texture.length; cnt++)
		{
			if (shape._webgl.texture[cnt])
			{
				tex = null;
				if (shape._cf.appearance.node._cf.texture.node) {
					tex = shape._cf.appearance.node._cf.texture.node.getTexture(cnt);
				}
				
				if (shape._webgl.texture[cnt].textureCubeReady && tex && 
					x3dom.isa(tex, x3dom.nodeTypes.X3DEnvironmentTextureNode))
				{
					gl.activeTexture(activeTex[cnt]);
					gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
					//gl.disable(gl.TEXTURE_CUBE_MAP);
				}
				else
				{
					gl.activeTexture(activeTex[cnt]);
					gl.bindTexture(gl.TEXTURE_2D, null);
				}
			}
		}
		if (oneShadowExistsAlready) 
		{
			gl.activeTexture(activeTex[cnt]);
			gl.bindTexture(gl.TEXTURE_2D, null);
		}
		//gl.disable(gl.TEXTURE_2D);
		
		for (df=0; df<shape._webgl.dynamicFields.length; df++)
		{
			attrib = shape._webgl.dynamicFields[df];
			
			if (sp[attrib.name] !== undefined) {
				gl.disableVertexAttribArray(sp[attrib.name]);
			}
		}
	};
    
	Context.prototype.renderScene = function (viewarea, pick) 
	{
		var gl = this.ctx3d;
        
        if (gl === null || scene === null)
        {
            return;
        }
        var scene = viewarea._scene;
        
        var rentex = viewarea._doc._nodeBag.renderTextures;
        var rt_tex, rtl_i, rtl_n = rentex.length;
        
		if (!scene._webgl)
        {
            scene._webgl = {};
            this.setupFgnds(gl, scene);
            
            // scale factor for mouse coords and width/ height (low res for speed-up)
            scene._webgl.pickScale = 0.5;
            scene._webgl.fboPick = this.initFbo(gl, 
                        this.canvas.width  * scene._webgl.pickScale, 
                        this.canvas.height * scene._webgl.pickScale, true);
                        
            scene._webgl.fboPick.pixelData = null;
            scene._webgl.pickShader = getDefaultShaderProgram(gl, 'pick');
            scene._webgl.pickColorShader = getDefaultShaderProgram(gl, 'vertexcolorUnlit');
            scene._webgl.pickTexCoordShader = getDefaultShaderProgram(gl, 'texcoordUnlit');
            
            scene._webgl.fboShadow = this.initFbo(gl, 1024, 1024, false);
            scene._webgl.shadowShader = getDefaultShaderProgram(gl, 'shadow');
            
            // TODO; for testing do it on init, but must be refreshed on change
            for (rtl_i=0; rtl_i<rtl_n; rtl_i++) {
                rt_tex = rentex[rtl_i];
                rt_tex._webgl = {};
                rt_tex._webgl.fbo = this.initFbo(gl, rt_tex._vf.dimensions[0], rt_tex._vf.dimensions[1], false);
            }
		}
        
        var bgnd = scene.getBackground();
        this.setupScene(gl, bgnd);
        
        var t0, t1;
        this.numFaces = 0;
        this.numCoords = 0;
		
		// render traversal
		if (scene.drawableObjects === undefined || !scene.drawableObjects)
        {
			scene.drawableObjects = [];
            scene.drawableObjects.LODs = [];
			
			t0 = new Date().getTime();
			
			scene.collectDrawableObjects(x3dom.fields.SFMatrix4f.identity(), scene.drawableObjects);
			
			t1 = new Date().getTime() - t0;
			
			if (this.canvas.parent.statDiv) {
				this.canvas.parent.statDiv.appendChild(document.createElement("br"));
				this.canvas.parent.statDiv.appendChild(document.createTextNode("traverse: " + t1));
			}
		}
        
        var mat_view = viewarea.getViewMatrix();
        var mat_scene = viewarea.getWCtoCCMatrix();
        
		// sorting and stuff
		t0 = new Date().getTime();
		
		// do z-sorting for transparency (currently no separate transparency list)
		var zPos = [];
        var i, n = scene.drawableObjects.length;
        var center, trafo, obj3d;
        
		for (i=0; i<n; i++)
		{
			trafo = scene.drawableObjects[i][0];
			obj3d = scene.drawableObjects[i][1];
            
            // do also init of GL objects
            this.setupShape(gl, obj3d, viewarea);
			
			center = obj3d.getCenter();
			center = trafo.multMatrixPnt(center);
			center = mat_view.multMatrixPnt(center);
            
			zPos[i] = [i, center.z];
		}
		zPos.sort(function(a, b) { return a[1] - b[1]; });
        
        n = scene.drawableObjects.LODs.length;
        if (n) {
            center = new x3dom.fields.SFVec3f(0, 0, 0); // eye
            center = mat_view.inverse().multMatrixPnt(center);
        }
        
        for (i=0; i<n; i++)
		{
			trafo = scene.drawableObjects.LODs[i][0];
			obj3d = scene.drawableObjects.LODs[i][1];
            
            if (obj3d) {
                obj3d._eye = trafo.inverse().multMatrixPnt(center);
            }
		}
		
		t1 = new Date().getTime() - t0;
		
		if (this.canvas.parent.statDiv) {
			this.canvas.parent.statDiv.appendChild(document.createElement("br"));
			this.canvas.parent.statDiv.appendChild(document.createTextNode("sort: " + t1));
		}
        
        // render color-buf pass for picking
        if (pick)
        {
            var pickMode = (scene._vf.pickMode.toLowerCase() === "color") ? 1 :
                            ((scene._vf.pickMode.toLowerCase() === "texcoord") ? 2 : 0);
            //t0 = new Date().getTime();
            
            // TODO; optimize call by reusing calculated volume!
            var min = x3dom.fields.SFVec3f.MAX();
            var max = x3dom.fields.SFVec3f.MIN();
            
            if (pickMode === 0) {
                scene.getVolume(min, max, true);
            }
            
            t0 = new Date().getTime();
            
            this.renderPickingPass(gl, scene, mat_view, mat_scene, min, max, 
                                   pickMode, viewarea._lastX, viewarea._lastY);
								   
            viewarea._updatePicking = false;
            
            //var index = ( (scene._webgl.fboPick.height - 1 - scene._lastY) * 
            //               scene._webgl.fboPick.width + scene._lastX ) * 4;
            var index = 0;
            if (index >= 0 && index < scene._webgl.fboPick.pixelData.length) {
                var pickPos = new x3dom.fields.SFVec3f(0, 0, 0);
                var charMax = (pickMode > 0) ? 1 : 255;
                
                pickPos.x = scene._webgl.fboPick.pixelData[index + 0] / charMax;
                pickPos.y = scene._webgl.fboPick.pixelData[index + 1] / charMax;
                pickPos.z = scene._webgl.fboPick.pixelData[index + 2] / charMax;
                
                if (pickMode === 0) {
                    pickPos = pickPos.multComponents(max.subtract(min)).add(min);
                }
                var objId = 255 - scene._webgl.fboPick.pixelData[index + 3];
                //x3dom.debug.logInfo(pickPos + " / " + objId);
                
                if (objId > 0) {
                    //x3dom.debug.logInfo(x3dom.nodeTypes.Shape.idMap.nodeID[objId]._DEF + " // " +
                    //                    x3dom.nodeTypes.Shape.idMap.nodeID[objId]._xmlNode.localName);
                    viewarea._pickingInfo.pickPos = pickPos;
                    viewarea._pickingInfo.pickObj = x3dom.nodeTypes.Shape.idMap.nodeID[objId];
                }
                viewarea._pickingInfo.updated = true;               
            }
            
            t1 = new Date().getTime() - t0;
            x3dom.debug.logInfo("Picking time (idBuf): " + t1 + "ms");
        }
		
		//===========================================================================
		// Render Shadow Pass
		//===========================================================================
		
		var slights = viewarea.getLights();	
		var numLights = slights.length;
		var oneShadowExistsAlready = false;
		
		for(var p=0; p<numLights; p++){
			//FIXME!!! Shadowing for only one Light
			if(slights[p]._vf.shadowIntensity > 0.0 && !oneShadowExistsAlready){
				oneShadowExistsAlready = true;
				t0 = new Date().getTime();

				// FIXME; iterate over all lights
				var lightMatrix = viewarea.getLightMatrix()[0];
				var mat_light = viewarea.getWCtoLCMatrix(lightMatrix);
				
				this.renderShadowPass(gl, scene, lightMatrix, mat_light);
				t1 = new Date().getTime() - t0;
				
				if (this.canvas.parent.statDiv) {
					this.canvas.parent.statDiv.appendChild(document.createElement("br"));
					this.canvas.parent.statDiv.appendChild(document.createTextNode("shadow: " + t1));
				}	
			}
		}
        
        for (rtl_i=0; rtl_i<rtl_n; rtl_i++) {
            this.renderRTPass(gl, viewarea, rentex[rtl_i]);
        }
		
        // rendering
		t0 = new Date().getTime();
        
		gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		
        // calls gl.clear etc. (bgnd stuff)
        bgnd._webgl.render(gl, mat_scene);
		
		gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        
        //gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
        //gl.enable(gl.SAMPLE_COVERAGE);
        //gl.sampleCoverage(0.5, false);
		
		//gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        //Workaround for WebKit & Co.
        gl.blendFuncSeparate(
					gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
					//gl.ONE_MINUS_DST_ALPHA, gl.ONE
                    gl.ONE, gl.ONE
                    //gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA
                );
        gl.enable(gl.BLEND);
        
        // currently maximum of 4 supported in Mozilla
        var activeTex = [gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2, gl.TEXTURE3,
                         gl.TEXTURE4, gl.TEXTURE5, gl.TEXTURE6, gl.TEXTURE7];
		
		for (i=0, n=zPos.length; i<n; i++)
		{
			var obj = scene.drawableObjects[zPos[i][0]];
			this.renderShape(obj[0], obj[1], viewarea, slights, numLights, 
                mat_view, mat_scene, mat_light, gl, activeTex, oneShadowExistsAlready);
		}
		
		gl.disable(gl.BLEND);
		/*gl.blendFuncSeparate( // just multiply dest RGB by its A
			gl.ZERO, gl.DST_ALPHA,
			gl.ZERO, gl.ONE
		);*/ 
		gl.disable(gl.DEPTH_TEST);
		
        if (viewarea._visDbgBuf !== undefined && viewarea._visDbgBuf)
        {
            if (scene._vf.pickMode.toLowerCase() === "idbuf" || 
                scene._vf.pickMode.toLowerCase() === "color" ||
                scene._vf.pickMode.toLowerCase() === "texcoord") {
                gl.viewport(0, 3*this.canvas.height/4, 
                            this.canvas.width/4, this.canvas.height/4);
                scene._fgnd._webgl.render(gl, scene._webgl.fboPick.tex);
            }
            
            if (oneShadowExistsAlready) {
                gl.viewport(this.canvas.width/4, 3*this.canvas.height/4, 
                            this.canvas.width/4, this.canvas.height/4);
                scene._fgnd._webgl.render(gl, scene._webgl.fboShadow.tex);
            }
        }
        gl.flush();
		
		t1 = new Date().getTime() - t0;
			
		if (this.canvas.parent.statDiv) {
			this.canvas.parent.statDiv.appendChild(document.createElement("br"));
			this.canvas.parent.statDiv.appendChild(document.createTextNode("render: " + t1));
            this.canvas.parent.statDiv.appendChild(document.createElement("br"));
            this.canvas.parent.statDiv.appendChild(document.createTextNode("#Tris: " + this.numFaces));
            this.canvas.parent.statDiv.appendChild(document.createElement("br"));
            this.canvas.parent.statDiv.appendChild(document.createTextNode("#Pnts: " + this.numCoords));
		}
		
		scene.drawableObjects = null;
	};
    
    Context.prototype.renderRTPass = function(gl, viewarea, rt)
	{
		var scene = viewarea._scene;
        var bgnd = null; 
        
        var mat_view = rt.getViewMatrix();
        var mat_scene = rt.getWCtoCCMatrix();
		
		var lightMatrix = viewarea.getLightMatrix()[0];
		var mat_light = viewarea.getWCtoLCMatrix(lightMatrix);
        
        var i, n, m = rt._cf.excludeNodes.nodes.length;
        
        var arr = new Array(m);
        for (i=0; i<m; i++) {
            var render = rt._cf.excludeNodes.nodes[i]._vf.render;
            if (render === undefined) {
                arr[i] = -1;
            }
            else {
                if (render === true)
                    arr[i] = 1;
                else 
                    arr[i] = 0;
            }
            rt._cf.excludeNodes.nodes[i]._vf.render = false;
        }
		
		gl.bindFramebuffer(gl.FRAMEBUFFER, rt._webgl.fbo.fbo);
        
        gl.viewport(0, 0, rt._webgl.fbo.width, rt._webgl.fbo.height);
		
        if (rt._cf.background.node === null) 
        {
            gl.clearColor(0, 0, 0, 1);
            gl.clearDepth(1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        }
        else if (rt._cf.background.node === scene.getBackground())
        {
            bgnd = scene.getBackground();
            bgnd._webgl.render(gl, mat_scene);
        }
        else 
        {
            bgnd = rt._cf.background.node;
            this.setupScene(gl, bgnd);
            bgnd._webgl.render(gl, mat_scene);
        }
		
		gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        
        gl.blendFuncSeparate(
					gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
                    gl.ONE, gl.ONE
                );
        gl.enable(gl.BLEND);
        
		var slights = viewarea.getLights();	
		var numLights = slights.length;
		var oneShadowExistsAlready = false;
		
        var activeTex = [gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2, gl.TEXTURE3,
                         gl.TEXTURE4, gl.TEXTURE5, gl.TEXTURE6, gl.TEXTURE7];
		
        var transform, shape;
        var locScene = rt._cf.scene.node;
        
        if (!locScene || locScene === scene)
        {
            n = scene.drawableObjects.length;
            
            for (i=0; i<n; i++)
            {
                transform = scene.drawableObjects[i][0];
                shape = scene.drawableObjects[i][1];
                
                if (shape._vf.render !== undefined && shape._vf.render === false)
                   continue;
                
                this.renderShape(transform, shape, viewarea, slights, numLights, 
                        mat_view, mat_scene, mat_light, gl, activeTex, oneShadowExistsAlready);
            }
		}
        else
        {
            locScene.drawableObjects = [];
            locScene.collectDrawableObjects(x3dom.fields.SFMatrix4f.identity(), locScene.drawableObjects);
            
            n = locScene.drawableObjects.length;
            
            for (i=0; i<n; i++)
            {
                transform = locScene.drawableObjects[i][0];
                shape = locScene.drawableObjects[i][1];
                
                if (shape._vf.render !== undefined && shape._vf.render === false)
                   continue;
                
                this.setupShape(gl, shape, viewarea);
                
                this.renderShape(transform, shape, viewarea, slights, numLights, 
                        mat_view, mat_scene, mat_light, gl, activeTex, oneShadowExistsAlready);
            }
        }
        
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		
		gl.flush();
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        for (i=0; i<m; i++) {
            if (arr[i] !== 0) {
                rt._cf.excludeNodes.nodes[i]._vf.render = true;
            }
        }
    };
	
	Context.prototype.shutdown = function(viewarea)
	{
		var gl = this.ctx3d;
        
        if (gl === null || scene === null || !scene || scene.drawableObjects === null)
        {
            return;
        }
        var scene = viewarea._scene;
		
		// TODO; optimize traversal, matrices are not needed for cleanup
		scene.collectDrawableObjects(x3dom.fields.SFMatrix4f.identity(), scene.drawableObjects);
        
        var bgnd = scene.getBackground();
        if (bgnd._webgl.texture !== undefined && bgnd._webgl.texture)
        {
            gl.deleteTexture(bgnd._webgl.texture);
        }
        if (bgnd._webgl.shader.position !== undefined) 
        {
            gl.deleteBuffer(bgnd._webgl.buffers[1]);
            gl.deleteBuffer(bgnd._webgl.buffers[0]);
        }
		
		for (var i=0, n=scene.drawableObjects.length; i<n; i++)
		{
			var shape = scene.drawableObjects[i][1];
			var sp = shape._webgl.shader;
			
            for (var cnt=0; shape._webgl.texture !== undefined && 
                            cnt < shape._webgl.texture.length; cnt++)
            {
                if (shape._webgl.texture[cnt])
                {
                    gl.deleteTexture(shape._webgl.texture[cnt]);
                }
            }
			
            for (var q=0; q<shape._webgl.positions.length; q++)
            {
                if (sp.position !== undefined) 
                {
                    gl.deleteBuffer(shape._webgl.buffers[5*q+1]);
                    gl.deleteBuffer(shape._webgl.buffers[5*q+0]);
                }
                
                if (sp.normal !== undefined) 
                {
                    gl.deleteBuffer(shape._webgl.buffers[5*q+2]);
                }
                
                if (sp.texcoord !== undefined) 
                {
                    gl.deleteBuffer(shape._webgl.buffers[5*q+3]);
                }
                
                if (sp.color !== undefined)
                {
                    gl.deleteBuffer(shape._webgl.buffers[5*q+4]);
                }
            }
            
            for (var df=0; df<shape._webgl.dynamicFields.length; df++)
            {
                var attrib = shape._webgl.dynamicFields[df];
                
                if (sp[attrib.name] !== undefined)
                {
                    gl.deleteBuffer(attrib.buf);
                }
            }
		}
	};
    
    Context.prototype.loadCubeMap = function(gl, url, doc, bgnd)
    {
        var texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

        var faces;
        if (bgnd) {
            faces = [gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 
                     gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 
                     gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X];
        }
        else {
            faces = [gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                     gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                     gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z];
        }
        texture.pendingTextureLoads = -1;
        texture.textureCubeReady = false;
        
        for (var i=0; i<faces.length; i++) {
            var face = faces[i];
            var image = new Image();
            texture.pendingTextureLoads++;
            doc.downloadCount += 1;
            
            image.onload = function(texture, face, image, swap) {
                return function() {
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, swap);
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
                    gl.texImage2D(face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                    
                    texture.pendingTextureLoads--;
					doc.downloadCount -= 1;
                    if (texture.pendingTextureLoads < 0) {
                        texture.textureCubeReady = true;
                        x3dom.debug.logInfo("Loading CubeMap finished...");
						doc.needRender = true;
                    }
                };
            }( texture, face, image, (bgnd && (i<=1 || i>=4)) );
            
            // backUrl, frontUrl, bottomUrl, topUrl, leftUrl, rightUrl (for bgnd)
            image.src = url[i];
        }
        
        return texture;
    };
    
    // start of fbo init stuff
    Context.prototype.emptyTexImage2D = function(gl, internalFormat, width, height, format, type)
    {
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
        }
        catch (e) {

            var bytes = 3;
            switch (internalFormat)
            {
                case gl.DEPTH_COMPONENT: bytes = 3; break;
                case gl.ALPHA: bytes = 1; break;
                case gl.RGB: bytes = 3; break;
                case gl.RGBA: bytes = 4; break;
                case gl.LUMINANCE: bytes = 1; break;
                case gl.LUMINANCE_ALPHA: bytes = 2; break;
            }
            var pixels = new Uint8Array(width * height * bytes);
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, pixels);
        }
    };

    Context.prototype.initTex = function(gl, w, h, nearest)
    {
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        
        this.emptyTexImage2D(gl, gl.RGBA, w, h, gl.RGBA, gl.UNSIGNED_BYTE);
        //this.emptyTexImage2D(gl, gl.DEPTH_COMPONENT16, w, h, gl.DEPTH_COMPONENT, gl.UNSIGNED_BYTE);
        
        if (nearest) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        }
        else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        //gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        tex.width = w;
        tex.height = h;
        
        return tex;
    };

    /*
     * Creates FBO with given size
     *   taken from FBO utilities for WebGL by Emanuele Ruffaldi 2009
     * Returned Object has
     *   rbo, fbo, tex, width, height
     */
    Context.prototype.initFbo = function(gl, w, h, nearest)
    {
        var status = 0;
        var fbo = gl.createFramebuffer();
        var rb = gl.createRenderbuffer();
        var tex = this.initTex(gl, w, h, nearest);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        x3dom.debug.logInfo("FBO-Status: " + status);
        
        var r = {};
        r.fbo = fbo;
        r.rbo = rb;
        r.tex = tex;
        r.width = w;
        r.height = h;
        
        return r;
    };

	return setupContext;

})();
