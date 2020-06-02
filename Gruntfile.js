const path = require('path');
const _ = require('lodash');
const ghpages = require('gh-pages');


module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),


    //we process the sass files from bootstrap, giving us the ability to modify 
    //the templates (for example, using a different grid layout, or adjusting gutters, or default fonts)
    'dart-sass': {
      target: {
        options: {
          outputStyle: 'compressed'
        },
        files: {
          './dist/css/style.css': './src/scss/bootstrap_variables.scss'
        }
      }
    },


    /*
     * Download local copies of Google fonts, this way we don't rely on Google's servers
     * and have better privacy. Google's license allows for local copies. 
     * https://developers.google.com/fonts/faq
     *
     * In addition to changing the fonts here, you'll need to
     * edit the variables in scss/bootstrap_variables.scss to match the fonts you specify.
     */
    googlefonts: {
      build: {
        options: {
          fontPath: 'src/fonts/',
          httpPath: '../fonts/',
          cssFile: 'src/fonts/fonts.css',
          fonts: [

            //add additional fonts here if you wish
            {
              family: 'Lato',
              styles: [
                100, 400, 700, 900
              ]
            },
            {
              family: 'Crimson Text',
              styles: [
                400, 600
              ]            
            }
          ]
        }
      }
    },

    //remove the dist (build) folder and start over.
    clean:{
      dist: ['dist/**/*']
    },

    //copy the fonts, js and assets folder (no css, because we process sass first)
    copy: {
      js: {
        expand: true,
        cwd: 'src/',
        src: ['**/*.js'], 
        dest: 'dist/' 
      },
      fonts:{
        expand: true,
        cwd: 'src/',
        src: ['fonts/**/*'], 
        dest: 'dist/'
      },
      data: {
        expand: true,
        cwd: 'src/',
        src: ['data/**/*.csv', 'data/**/*.json'],
        dest: 'dist/'  
      },
      // html: {
      //   expand: true,
      //   cwd: 'src/',
      //   src: ['**/*.html', '!partials/**'],
      //   dest: 'dist/'  
      // },
      assets: {
        expand: true,
        cwd: 'src/',
        src: ['assets/**/*'],
        dest: 'dist/'      
      }
    },


    //watch for changes, and do a different action depending on situation
    watch: {
      options: {
        spawn: false,
        event: ['all'],
        livereload: true,
        cwd: 'src/'
      },
      scripts: {
        files: '**/*.js',
        tasks: ['copy:js']
      },
      datafiles: {
        files: ['data/**/*.csv', 'data/**/*.json'],
        tasks: ['copy:data']
      },
      styles: {
        files: ['css/**/*.css', 'scss/**/*.scss', 'assets/slick/**/*.scss'],
        tasks: ['dart-sass']
      },
      html: {
        files: ['**/*.html', 'partials/**'],
        tasks: ['html']
      },
      assets: {
        files: 'assets/**/*',
        tasks: ['copy:assets']
      }
    },

    //make a webserver on the dist folder
    connect: {
      server: {
        options: {
          port: 8000,
          hostname: 'localhost',
          livereload: true,
          base: "./dist"
        }
      }
    }


  });

  function encrypt(text){

    var CryptoJS = require("crypto-js");

    var password   = grunt.file.read('credentials.txt', {encoding:'utf8'});
    var iterations = 1000;
    var keySize    = 256;
    var ivSize     = 128;
    var salt       = CryptoJS.lib.WordArray.random(128/8);
    var output     = CryptoJS.PBKDF2(password, salt, {
                        keySize: (keySize+ivSize)/32,
                        iterations: iterations
                     });
    output.clamp();

    var key = CryptoJS.lib.WordArray.create(output.words.slice(0, keySize/32));
    var iv  = CryptoJS.lib.WordArray.create(output.words.slice(keySize/32));



    var payload = CryptoJS.AES.encrypt(
                text.toString(),
                CryptoJS.enc.Utf8.parse(key),
                {iv:iv});

    var hmac_digest = CryptoJS.HmacSHA256(
                payload.toString(), 
                CryptoJS.enc.Utf8.parse(key));

    // console.log("iv", iv.toString(CryptoJS.enc.Base64));
    // console.log("salt", salt.toString(CryptoJS.enc.Base64));
    // console.log("payload", payload.toString());
    // console.log("hmac", hmac_digest.toString(CryptoJS.enc.Base64));
    // console.log("key", key.toString(CryptoJS.enc.Base64));

    return `${iv.toString(CryptoJS.enc.Base64)}|${salt.toString(CryptoJS.enc.Base64)}|${hmac_digest.toString(CryptoJS.enc.Base64)}|${payload.toString()}`;

  }
  


  //This will publish a copy of this project to gh-pages branch so students can see it.
  grunt.registerTask('publish', 'Publish project to gh-pages', ()=>{
    ghpages.publish('dist',  {push: true}, function(err){
      grunt.log.writeln(err);
    });
  });


  grunt.registerTask('html', 'Process html with templates', ()=>{

    //hold data from partials folder. The format is { name_in_template_tag: "content from partials"}
    //for example, { projects: "<div> ...partials folder content... </div>" }
    //So <%= projects %> will suck from partials/projects.html and place in that spot
    var data = {};

    //read all the partials
    let files_in_partials_folder = grunt.file.expand({filter: 'isFile', cwd:'src/partials/'}, ["*.html"]);


    //iterate through each html file in partials, storing it in data variable, using filename as property
    files_in_partials_folder.forEach((file, index) => {

      //get the name of file without the extension, use that as propery for template tags.
      let basename = path.parse(files_in_partials_folder[index], '.html').name;

      //set data.partial_basename = html content
      data[basename] = encrypt(grunt.file.read('src/partials/' + file, {encoding:'utf8'}));

    });

    //read all found htmls files and process template tags, ignore partials folder
    let html_files_in_src = grunt.file.expand({filter: 'isFile', cwd:'src/'}, ['**/*.html', '!partials/*']);

    //for each html file, process template tags, replacing them with data properties that match
    html_files_in_src.forEach((file,index)=>{
      let f = grunt.file.read('src/' + file);
      let processed = grunt.template.process(f, {data:data});
      let finished = grunt.file.write('dist/' + file, processed, {encoding:'utf8'});
    });

  });


  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-dart-sass');
  grunt.loadNpmTasks('grunt-google-fonts');

  //intial setup, really only need to run this once unless adding new Google Fonts
  grunt.registerTask('setup', ['clean', 'googlefonts', 'copy:fonts', 'default']);

  //create build folder and run watch task
  grunt.registerTask('default', ['copy:assets','copy:js','html','copy:data','dart-sass','connect','watch']);

};