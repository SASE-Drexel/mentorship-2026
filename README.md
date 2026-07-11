# SASE Mentorship Program Profiles

Built with:
- Jekyll
- [Jekyll Onassis Theme](https://github.com/ohduran/Onassis)

## Useful Links
- [Jekyll Docs](https://jekyllrb.com/docs/)

## How to edit
Mentor and mentee profiles are stored in `.md` files under the `/collections` folder. Each file is rendered onto a template under `_layouts/post.html`

The entire website is built upon the html templates found in `_layouts` and `_includes`. To move content around, edit the HTML tags in those folders and rebuild the site.

### Adding/Editing Profiles

Navigate to `_collections/` and enter either the `_mentors` or `_mentees` directory. Select one of the existing `.md` files or add a new `.md` file directly. Modify content by directly editing the text within the document. Make sure to save changes after you've finished editing.

## Deploying
1. `git clone` the repo locally
2. `git checkout gh-pages`
3. `git pull` to make sure you have the most recent version
* make sure you have Ruby and Jekyll requirements installed (instructions below)
4. run `bundle exec jekyll build`
5. `git push` repo to master and check `https://sase-drexel.github.io/mentorship-profiles/` is updated with new profiles

## Viewing Locally

1. follow instructions on [install Jekyll locally](https://jekyllrb.com/docs/installation/)
2. `git clone` this repo
2a. run `gem install bundler` if you do not already have bundler installed
3. run `bundle install` to install repo dependencies
4. run `bundle exec jekyll serve` -- by default the site will be built into a new folder `_docs` and hosted on `localhost:4000`

